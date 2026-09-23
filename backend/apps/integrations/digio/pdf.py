"""Generate the 10-page loan agreement from HTML and stamp it after Aadhaar e-sign."""

from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from django.core.exceptions import ObjectDoesNotExist
from django.template.loader import render_to_string
from django.utils import timezone
from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import Color
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from xhtml2pdf import pisa

from apps.applications.services.application_service import ApplicationService
from apps.applications.services.sanction_fee_service import SanctionFeeService
from apps.customers.models import CustomerAddress
from apps.customers.services.customer_service import CustomerService
from apps.loans.services.loan_calculation_service import LoanCalculationService

ASSET_DIR = Path(__file__).resolve().parent / "assets"
PAGE_WIDTH = 595.0
PAGE_HEIGHT = 842.0

SIGNATURE_GREEN = (0x01 / 255, 0xA6 / 255, 0x01 / 255)

# Green tick outline in a unit box, y flipped for PDF space. A pair is a straight
# segment; a triple of pairs is a cubic curve's two controls plus its end point.
_TICK_RATIO = 122.88 / 109.76
_TICK_OUTLINE = (
    (0.0000, 0.5182),
    (0.1846, 0.5210),
    ((0.2559, 0.4749), (0.3197, 0.4154), (0.3746, 0.3400)),
    ((0.5167, 0.6038), (0.6799, 0.8199), (0.8594, 1.0000)),
    (1.0000, 1.0000),
    ((0.7491, 0.6880), (0.5444, 0.3539), (0.3806, 0.0000)),
    ((0.2931, 0.2102), (0.1706, 0.3871), (0.0000, 0.5182)),
)

# Reserved Digio stamp areas, measured from the top of the page. Kept above the
# footer band. The green tick is overlaid on the stamp after eSign.
_SIGNATURE_CARDS = {
    7: (370.0, 148.0, 175.0, 82.0),  # just below "Borrower Signature & Date"
    8: (381.0, 640.0, 168.0, 70.0),  # above the caption on Schedule 1
    9: (381.0, 640.0, 168.0, 70.0),
}

_WHITE_PNG: bytes | None = None
_LOGO_DATA_URI: str | None = None


def _stamp_area(page: int) -> tuple[float, float, float, float]:
    """Area Digio fills, as (x, top, width, height)."""
    return _SIGNATURE_CARDS[page]


def _sign_box(page: int) -> dict:
    x, top, width, height = _stamp_area(page)
    return {
        "llx": round(x),
        "lly": round(PAGE_HEIGHT - top - height),
        "urx": round(x + width),
        "ury": round(PAGE_HEIGHT - top),
    }


# Digio stamps the Aadhaar block on these pages only after the customer completes eSign.
LAST_THREE_SIGN_COORDINATES = {
    "8": [_sign_box(7)],
    "9": [_sign_box(8)],
    "10": [_sign_box(9)],
}


@dataclass(frozen=True)
class AgreementValues:
    borrower_name: str
    address: str
    office_address: str
    pan: str
    email: str
    email_line: str
    mobile: str
    execution_date: str
    application_number: str
    sanction_date: str
    principal: str
    interest_rate: str
    processing_fee: str
    gst: str
    disbursal_amount: str
    repayment_date: str
    repayment_amount: str
    tenure_days: str
    principal_rupee: str
    repayment_amount_rupee: str
    processing_fee_rupee: str
    apr: str
    cooling_off_days: str
    late_interest_rate: str


def _money(value) -> str:
    return f"Rs. {_decimal(value):,.2f}"


def _rupee(value) -> str:
    return _money(value)


def _date(value) -> str:
    parsed = _as_date(value)
    return parsed.strftime("%d/%m/%Y") if parsed else "—"


def _as_date(value) -> date | None:
    if not value:
        return None
    if isinstance(value, datetime):
        value = timezone.localtime(value).date() if timezone.is_aware(value) else value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _decimal(value, default: Decimal = Decimal("0")) -> Decimal:
    try:
        return Decimal(str(value))
    except Exception:
        return default


def _int(value, default: int = 0) -> int:
    try:
        return int(Decimal(str(value)))
    except Exception:
        return default


def _first_value(mapping: dict, *keys: str):
    for key in keys:
        item = mapping.get(key)
        if item not in (None, ""):
            return item
    return None


def _latest_address(customer):
    if customer is None:
        return None
    return CustomerAddress.objects.filter(customer=customer).order_by("-created_at").first()


def _format_address(address) -> str:
    if not address:
        return "—"
    return (
        ", ".join(
            part
            for part in (
                address.line1,
                address.line2,
                address.city,
                address.state,
                address.pincode,
            )
            if part
        )
        or "—"
    )


def _customer_address(customer) -> str:
    return _format_address(_latest_address(customer))


def _office_address(customer, details: dict) -> str:
    stored = _first_value(details, "office_address", "employer_address")
    if stored:
        return str(stored)
    if customer is None:
        return "—"
    employment = customer.employments.filter(is_current=True).order_by("-created_at").first()
    if employment and employment.employer_name:
        return employment.employer_name
    return "—"


def _customer_location(customer) -> str:
    address = _latest_address(customer)
    if not address:
        return "New Delhi"
    return (address.city or address.state or "New Delhi").strip() or "New Delhi"


def signer_from_lead(lead) -> tuple[str, str]:
    """Return (signer name, location) for the completed e-sign appearance."""
    customer = getattr(lead, "customer", None)
    name = (getattr(customer, "full_name", "") or "").strip()
    return name, _customer_location(customer)


def _application_for_lead(lead):
    return lead.applications.order_by("-created_at").first()


def _approved_decision(application):
    if application is None:
        return None
    return application.decisions.filter(decision="approved").order_by("-decided_at").first()


def _loan_for_application(application):
    if application is None:
        return None
    try:
        return application.loan
    except (ObjectDoesNotExist, AttributeError):
        return None


def _principal_amount(*, lead, application, decision) -> Decimal:
    if decision is not None and decision.approved_amount is not None:
        return _decimal(decision.approved_amount)
    if application is not None and application.approved_amount is not None:
        return _decimal(application.approved_amount)
    if application is not None and application.requested_amount is not None:
        return _decimal(application.requested_amount)
    return _decimal(getattr(lead, "required_amount", None))


def _interest_rate(*, application, decision, details: dict) -> Decimal:
    if decision is not None and decision.interest_rate is not None:
        return _decimal(decision.interest_rate)
    stored = _first_value(details, "roi", "interest_rate")
    if stored is not None:
        return _decimal(stored)
    if application is not None and application.product_id:
        return _decimal(application.product.interest_rate)
    return Decimal("0")


def _fee_breakdown(*, application, decision, details: dict, principal: Decimal) -> tuple:
    if application is not None:
        net = SanctionFeeService.net_disbursal_for_application(application)
    else:
        net = SanctionFeeService.compute_net_disbursal(
            principal_amount=principal,
            processing_fee=_first_value(details, "processing_fee", "admin_fees"),
            gst=_first_value(details, "gst", "admin_gst"),
            pf_percentage=_first_value(details, "pf_percentage"),
        )

    if decision is not None and decision.processing_fee is not None:
        processing_fee = _decimal(decision.processing_fee)
    else:
        processing_fee = _decimal(
            _first_value(details, "processing_fee", "admin_fees") or net.get("processing_fee")
        )

    gst = _first_value(details, "gst", "admin_gst")
    if gst is None:
        gst = net.get("gst")
    gst = _decimal(gst)

    disbursal = _first_value(details, "amount_to_be_disbursed", "disbursal_amount")
    if disbursal is None:
        disbursal = net.get("amount_to_be_disbursed")
    if disbursal is None:
        disbursal = max(Decimal("0"), principal - processing_fee - gst)
    return processing_fee, gst, _decimal(disbursal)


def _tenure_days(*, application, loan, decision, details: dict, repayment_at) -> int:
    tenure = 0
    if application is not None:
        tenure = LoanCalculationService.compute_contract_tenure_days(
            repayment_date=repayment_at,
            disbursal_date=LoanCalculationService.resolve_actual_disbursal_date(loan=loan),
            disbursal_sheet_sent_date=LoanCalculationService.resolve_sheet_sent_date(
                application=application
            ),
            sanction_date=LoanCalculationService.resolve_sanction_date(
                application=application,
                decision=decision,
            ),
        )
    if tenure > 0:
        return tenure
    if decision is not None and decision.approved_tenure_value:
        return int(decision.approved_tenure_value)
    stored = _first_value(details, "loan_tenure", "tenure_days")
    if stored not in (None, ""):
        return _int(stored)
    if application is not None and application.tenure_value:
        return int(application.tenure_value)
    return 0


def _repayment_amount(*, details: dict, principal: Decimal, interest: Decimal, tenure: int, due):
    stored = _first_value(details, "repay_amount", "repayment_amount")
    if stored is not None:
        return _decimal(stored)
    metrics = LoanCalculationService.compute_summary(
        principal_amount=principal,
        roi_percent=interest,
        contract_tenure_days=tenure,
        due_date=due,
    )
    return metrics.repay_amount


def _agreement_values(lead) -> AgreementValues:
    """Fill Schedule 1 / KFS from the latest approved sanction, not lead.required_amount."""
    customer = lead.customer
    application = _application_for_lead(lead)
    decision = _approved_decision(application)
    details = dict(decision.sanction_details or {}) if decision else {}
    loan = _loan_for_application(application)

    principal = _principal_amount(lead=lead, application=application, decision=decision)
    interest = _interest_rate(application=application, decision=decision, details=details)
    processing_fee, gst, disbursal = _fee_breakdown(
        application=application,
        decision=decision,
        details=details,
        principal=principal,
    )
    repayment_at = LoanCalculationService.resolve_repayment_date(
        application=application,
        loan=loan,
        decision=decision,
    )
    tenure = _tenure_days(
        application=application,
        loan=loan,
        decision=decision,
        details=details,
        repayment_at=repayment_at,
    )
    repayment = _repayment_amount(
        details=details,
        principal=principal,
        interest=interest,
        tenure=tenure,
        due=repayment_at,
    )

    execution_at = getattr(decision, "decided_at", None) or timezone.now()
    sanction_at = (
        LoanCalculationService.resolve_sanction_date(
            application=application,
            decision=decision,
        )
        or execution_at
    )

    apr = _first_value(details, "annual_percentage_rate", "apr")
    if apr is None:
        apr = (_decimal(interest) * Decimal("365")).quantize(Decimal("0.01"))

    late = _first_value(details, "late_interest_rate")
    if late is None and application is not None:
        late = LoanCalculationService.resolve_penalty_rate_percent(
            loan=loan,
            application=application,
        )
    if late in (None, "", 0, Decimal("0")):
        late = Decimal("1")

    cooling = _first_value(details, "cooling_off_days") or 3
    official = str(_first_value(details, "official_email") or "").strip()
    personal = getattr(customer, "email", None) or "—"
    email_line = f"Personal: {personal}"
    if official:
        email_line = f"{email_line} Official: {official}"

    return AgreementValues(
        borrower_name=(getattr(customer, "full_name", None) or "—"),
        address=_customer_address(customer),
        office_address=_office_address(customer, details),
        pan=CustomerService.get_primary_pan(customer) or "—",
        email=personal,
        email_line=email_line,
        mobile=getattr(customer, "mobile_number", None) or "—",
        execution_date=_date(execution_at),
        application_number=ApplicationService.display_application_number(
            getattr(application, "application_number", None) or lead.lead_id
        ),
        sanction_date=_date(sanction_at),
        principal=_money(principal),
        interest_rate=f"{_decimal(interest):.2f} %",
        processing_fee=_money(processing_fee),
        gst=_money(gst),
        disbursal_amount=_money(disbursal),
        repayment_date=_date(repayment_at),
        repayment_amount=_money(repayment),
        tenure_days=f"{int(tenure)} Days",
        principal_rupee=_rupee(principal),
        repayment_amount_rupee=_rupee(repayment),
        processing_fee_rupee=_rupee(processing_fee),
        apr=f"{_decimal(interest):.2f}% per day – {_decimal(apr):.2f}% per annum",
        cooling_off_days=f"{_int(cooling, 3)} Days",
        late_interest_rate=f"{_decimal(late):.2f}% per day",
    )


def _logo_data_uri() -> str:
    global _LOGO_DATA_URI
    if _LOGO_DATA_URI is not None:
        return _LOGO_DATA_URI
    path = ASSET_DIR / "knm-logo.png"
    if not path.is_file():
        _LOGO_DATA_URI = ""
        return _LOGO_DATA_URI
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    _LOGO_DATA_URI = f"data:image/png;base64,{encoded}"
    return _LOGO_DATA_URI


_CAPTION = "Borrower Signature & Date"


def _from_top(top: float) -> float:
    return PAGE_HEIGHT - top


def _draw_borrower_caption(pdf: canvas.Canvas, *, x: float, top: float, width: float) -> None:
    """Right-aligned caption sitting just below the signature stamp."""
    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont("Times-Bold", 10.5)
    text_width = pdf.stringWidth(_CAPTION, "Times-Bold", 10.5)
    pdf.drawString(x + max(0.0, width - text_width), _from_top(top), _CAPTION)


def _page_overlay(page, draw) -> bytes:
    stream = BytesIO()
    pdf = canvas.Canvas(
        stream,
        pagesize=(float(page.mediabox.width), float(page.mediabox.height)),
    )
    draw(pdf)
    pdf.showPage()
    pdf.save()
    return stream.getvalue()


def _white_png() -> bytes:
    global _WHITE_PNG
    if _WHITE_PNG is None:
        image = Image.new("RGB", (16, 16), (255, 255, 255))
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        _WHITE_PNG = buffer.getvalue()
    return _WHITE_PNG


def _cover_image(pdf: canvas.Canvas, x: float, top: float, width: float, height: float) -> None:
    pdf.setFillColorRGB(1, 1, 1)
    pdf.rect(x, _from_top(top + height), width, height, fill=1, stroke=0)
    pdf.drawImage(
        ImageReader(BytesIO(_white_png())),
        x,
        _from_top(top + height),
        width=width,
        height=height,
        preserveAspectRatio=False,
        mask=None,
        anchor="sw",
    )


def _draw_green_tick(
    pdf: canvas.Canvas, x: float, y: float, size: float, *, alpha: float = 0.28
) -> None:
    """Fill the tick-mark outline; keep it translucent so signed text stays readable."""
    height = size / _TICK_RATIO

    def at(point: tuple[float, float]) -> tuple[float, float]:
        return x + point[0] * size, y + point[1] * height

    pdf.saveState()
    pdf.setFillColor(Color(SIGNATURE_GREEN[0], SIGNATURE_GREEN[1], SIGNATURE_GREEN[2], alpha=alpha))
    path = pdf.beginPath()
    path.moveTo(*at(_TICK_OUTLINE[0]))
    for segment in _TICK_OUTLINE[1:]:
        if isinstance(segment[0], tuple):
            (c1x, c1y), (c2x, c2y), (end_x, end_y) = (at(point) for point in segment)
            path.curveTo(c1x, c1y, c2x, c2y, end_x, end_y)
        else:
            path.lineTo(*at(segment))
    path.close()
    pdf.drawPath(path, stroke=0, fill=1)
    pdf.restoreState()


def _signed_at_label(value: datetime | None = None) -> str:
    stamp = value or timezone.now()
    if timezone.is_aware(stamp):
        stamp = timezone.localtime(stamp)
    return stamp.strftime("%a %b %d %H:%M:%S IST")


def _draw_signed_appearance(
    pdf: canvas.Canvas,
    *,
    x: float,
    top: float,
    width: float,
    height: float,
    signer_name: str,
    signer_location: str,
    signed_at: str,
) -> None:
    """Black Times block with a translucent green tick behind the text."""
    _cover_image(pdf, x - 2, top - 1, width + 4, height + 2)
    name = signer_name or "Customer"
    location = signer_location or "New Delhi"
    lines = (
        "Digitally Signed by:",
        f"Name: {name}",
        f"Location: {location}",
        "Reason: Loan Agreement",
        f"Date: {signed_at}",
    )
    tick_w = min(width * 0.52, 46.0)
    tick_h = tick_w / _TICK_RATIO
    _draw_green_tick(
        pdf,
        x + width * 0.22,
        _from_top(top + height) + (height - tick_h) / 2,
        tick_w,
        alpha=0.22,
    )
    size = 9.5 if height >= 72 else 9.0
    leading = 11.5 if height >= 72 else 10.5
    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont("Times-Bold", size)
    text_y = _from_top(top + 12)
    for line in lines:
        pdf.drawString(x + 6, text_y, line)
        text_y -= leading


def apply_completed_signature_marks(
    pdf_bytes: bytes,
    *,
    signer_name: str = "",
    signer_location: str = "",
    signed_at: datetime | None = None,
) -> bytes:
    """Replace Digio's visible stamp with the five-line Times-Bold block and tick."""
    if not pdf_bytes or not pdf_bytes.lstrip().startswith(b"%PDF"):
        return pdf_bytes
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
    except Exception:
        return pdf_bytes
    if len(reader.pages) < 8:
        return pdf_bytes

    writer = PdfWriter()
    overlays: dict[int, bytes] = {}
    when = _signed_at_label(signed_at)
    try:
        for index, (x, top, width, height) in _SIGNATURE_CARDS.items():
            if index >= len(reader.pages):
                continue
            stream = BytesIO()
            page = reader.pages[index]
            page_width = float(page.mediabox.width)
            page_height = float(page.mediabox.height)
            pdf = canvas.Canvas(stream, pagesize=(page_width, page_height))
            _draw_signed_appearance(
                pdf,
                x=x,
                top=top,
                width=width,
                height=height,
                signer_name=signer_name,
                signer_location=signer_location,
                signed_at=when,
            )
            if index in (8, 9):
                _draw_borrower_caption(pdf, x=x, top=top + height + 12, width=width)
            pdf.showPage()
            pdf.save()
            overlays[index] = stream.getvalue()

        for index, page in enumerate(reader.pages):
            overlay = overlays.get(index)
            if overlay:
                page.merge_page(PdfReader(BytesIO(overlay)).pages[0])
            writer.add_page(page)
        _strip_form(writer)
        if reader.metadata:
            writer.add_metadata(
                {str(key): str(value) for key, value in dict(reader.metadata).items()}
            )
        output = BytesIO()
        writer.write(output)
        return output.getvalue()
    except Exception:
        return pdf_bytes


def _strip_form(writer: PdfWriter) -> None:
    root = getattr(writer, "_root_object", None)
    if root is not None and "/AcroForm" in root:
        del root["/AcroForm"]
    for page in writer.pages:
        if page.get("/Annots") is not None:
            del page["/Annots"]


def _html_to_pdf(html: str) -> bytes:
    output = BytesIO()
    result = pisa.CreatePDF(src=html, dest=output, encoding="utf-8")
    if getattr(result, "err", 0):
        raise RuntimeError("Failed to render loan agreement PDF")
    pdf_bytes = output.getvalue()
    if not pdf_bytes.lstrip().startswith(b"%PDF"):
        raise RuntimeError("Loan agreement renderer did not return a PDF")
    return pdf_bytes


def build_agreement_pdf(*, lead) -> bytes:
    """Return a 10-page agreement whose Schedule 1 / KFS match the sanctioned terms."""
    values = _agreement_values(lead)
    html = render_to_string(
        "agreements/loan_agreement.html",
        {"v": values, "logo_uri": _logo_data_uri()},
    )
    reader = PdfReader(BytesIO(_html_to_pdf(html)))
    writer = PdfWriter()
    for index, page in enumerate(reader.pages):
        card = _SIGNATURE_CARDS.get(index)
        if card and index in (8, 9):
            x, top, width, height = card
            overlay = _page_overlay(
                page,
                lambda pdf, x=x, top=top, width=width, height=height: _draw_borrower_caption(
                    pdf, x=x, top=top + height + 12, width=width
                ),
            )
            page.merge_page(PdfReader(BytesIO(overlay)).pages[0])
        writer.add_page(page)
    _strip_form(writer)
    writer.add_metadata(
        {
            "/Title": f"Loan Agreement - {values.application_number}",
            "/Subject": f"Unsigned agreement for {values.borrower_name}",
        }
    )
    output = BytesIO()
    writer.write(output)
    return output.getvalue()
