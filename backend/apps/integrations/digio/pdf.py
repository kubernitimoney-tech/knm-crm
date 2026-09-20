"""Create an unsigned, lead-specific agreement from the 10-page KNM template."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.utils import timezone
from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from apps.customers.models import CustomerAddress
from apps.customers.services.customer_service import CustomerService

ASSET_DIR = Path(__file__).resolve().parent / "assets"
TEMPLATE_PATH = ASSET_DIR / "loan-agreement-static.pdf"
PAGE_WIDTH = 595.0
PAGE_HEIGHT = 842.0

# Digio stamps the Aadhaar block on these pages only after the customer completes eSign.
# Boxes are wide enough for Digio's green tick plus the signed-by text.
LAST_THREE_SIGN_COORDINATES = {
    "8": [{"llx": 330, "lly": 400, "urx": 575, "ury": 545}],
    "9": [{"llx": 330, "lly": 48, "urx": 580, "ury": 170}],
    "10": [{"llx": 330, "lly": 48, "urx": 580, "ury": 170}],
}

# Extra green tick drawn on the signed PDF (last three pages, left of the Digio text).
_COMPLETED_TICKS = (
    (7, 400, 442, 36),
    (8, 418, 54, 36),
    (9, 418, 54, 36),
)

_LOGO_PNG: bytes | None = None
_LOGO_READY = False
_WHITE_PNG: bytes | None = None


@dataclass(frozen=True)
class AgreementValues:
    borrower_name: str
    address: str
    pan: str
    email: str
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
    apr: str
    cooling_off_days: str
    late_interest_rate: str


def _money(value) -> str:
    try:
        amount = Decimal(str(value or "0"))
    except Exception:
        amount = Decimal("0")
    return f"Rs. {amount:,.2f}"


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


def _first_value(mapping: dict, *keys: str):
    for key in keys:
        item = mapping.get(key)
        if item not in (None, ""):
            return item
    return None


def _customer_address(customer) -> str:
    address = CustomerAddress.objects.filter(customer=customer).order_by("-created_at").first()
    if not address:
        return "—"
    return ", ".join(
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


def _agreement_values(lead) -> AgreementValues:
    customer = lead.customer
    application = lead.applications.order_by("-created_at").first()
    decision = (
        application.decisions.filter(decision="approved").order_by("-decided_at").first()
        if application
        else None
    )
    details = dict(decision.sanction_details or {}) if decision else {}
    try:
        loan = application.loan if application else None
    except Exception:
        loan = None

    principal = (
        getattr(decision, "approved_amount", None)
        or getattr(application, "approved_amount", None)
        or getattr(application, "requested_amount", None)
        or lead.required_amount
        or Decimal("0")
    )
    processing_fee = (
        getattr(decision, "processing_fee", None)
        or _first_value(details, "processing_fee", "admin_fees")
        or getattr(loan, "processing_fee", None)
        or Decimal("0")
    )
    gst = _first_value(details, "gst", "admin_gst")
    if gst is None:
        gst = (_decimal(processing_fee) * Decimal("0.18")).quantize(Decimal("0.01"))
    disbursal = _first_value(details, "amount_to_be_disbursed", "disbursal_amount")
    if disbursal is None:
        disbursal = max(Decimal("0"), _decimal(principal) - _decimal(processing_fee) - _decimal(gst))
    repayment = (
        _first_value(details, "repay_amount", "repayment_amount")
        or getattr(loan, "total_repayable", None)
        or principal
    )
    interest = (
        getattr(decision, "interest_rate", None)
        or _first_value(details, "interest_rate", "roi")
        or getattr(loan, "interest_rate", None)
        or Decimal("0")
    )
    tenure = (
        getattr(decision, "approved_tenure_value", None)
        or getattr(application, "tenure_value", None)
        or _first_value(details, "tenure_days", "loan_tenure")
        or 0
    )
    execution_at = getattr(decision, "decided_at", None) or timezone.now()
    repayment_at = getattr(loan, "due_date", None) or _first_value(
        details, "repayment_date", "due_date"
    )
    apr = _first_value(details, "annual_percentage_rate", "apr")
    if apr is None:
        apr = (_decimal(interest) * Decimal("365")).quantize(Decimal("0.01"))

    return AgreementValues(
        borrower_name=customer.full_name or "—",
        address=_customer_address(customer),
        pan=CustomerService.get_primary_pan(customer) or "—",
        email=customer.email or "—",
        mobile=customer.mobile_number or "—",
        execution_date=_date(execution_at),
        application_number=getattr(application, "application_number", None) or lead.lead_id,
        sanction_date=_date(getattr(decision, "decided_at", None) or execution_at),
        principal=_money(principal),
        interest_rate=f"{_decimal(interest):.2f} %",
        processing_fee=_money(processing_fee),
        gst=_money(gst),
        disbursal_amount=_money(disbursal),
        repayment_date=_date(repayment_at),
        repayment_amount=_money(repayment),
        tenure_days=f"{tenure} Days",
        apr=f"{_decimal(interest):.2f}% per day – {_decimal(apr):.2f}% per annum",
        cooling_off_days=f"{_first_value(details, 'cooling_off_days') or 3} Days",
        late_interest_rate=f"{_first_value(details, 'late_interest_rate') or '1'}% per day",
    )


def _fit_text(text: str, width: float, *, font: str = "Helvetica", size: float = 9) -> float:
    while size > 6 and stringWidth(text, font, size) > width:
        size -= 0.5
    return size


def _logo_path() -> Path | None:
    candidates = (
        Path(getattr(settings, "EMAIL_LOGO_PATH", "") or ""),
        Path(getattr(settings, "BASE_DIR", "")) / "static" / "emails" / "logo.png",
        ASSET_DIR / "knm-logo.png",
    )
    return next((path for path in candidates if path.is_file()), None)


def _logo_png_bytes() -> bytes | None:
    global _LOGO_PNG, _LOGO_READY
    if _LOGO_READY:
        return _LOGO_PNG
    _LOGO_READY = True
    path = _logo_path()
    if path is None:
        return None
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    for row in range(height):
        for col in range(width):
            red, green, blue, alpha = pixels[col, row]
            if alpha and red < 40 and green < 40 and blue < 40:
                pixels[col, row] = (red, green, blue, 0)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    _LOGO_PNG = buffer.getvalue()
    return _LOGO_PNG


def _from_top(top: float) -> float:
    return PAGE_HEIGHT - top


def _white_png() -> bytes:
    global _WHITE_PNG
    if _WHITE_PNG is None:
        image = Image.new("RGB", (16, 16), (255, 255, 255))
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        _WHITE_PNG = buffer.getvalue()
    return _WHITE_PNG


def _cover(pdf: canvas.Canvas, x: float, top: float, width: float, height: float) -> None:
    pdf.setFillColorRGB(1, 1, 1)
    pdf.rect(x, _from_top(top + height), width, height, fill=1, stroke=0)


def _cover_image(pdf: canvas.Canvas, x: float, top: float, width: float, height: float) -> None:
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


def _draw_brand_logo(pdf: canvas.Canvas) -> None:
    """Replace the footer Har Shreejee wordmark and red seal with the KNM logo."""
    _cover_image(pdf, 150, 755, 300, 55)
    _cover_image(pdf, 246, 798, 104, 40)
    logo = _logo_png_bytes()
    if not logo:
        return
    pdf.drawImage(
        ImageReader(BytesIO(logo)),
        172,
        34,
        width=250,
        height=50,
        preserveAspectRatio=True,
        mask="auto",
        anchor="sw",
    )


def _wipe_sample_signature(pdf: canvas.Canvas, index: int) -> None:
    """Blank leftover Digio stamps. The ticked sign is applied only after eSign completes."""
    _cover_image(pdf, 440, 752, 155, 42)
    if index == 7:
        # Keep "Borrower Signature & Date"; hide the sample signed-by block under it.
        _cover_image(pdf, 385, 365, 185, 50)


def _draw_green_tick(pdf: canvas.Canvas, x: float, y: float, size: float) -> None:
    pdf.setFillColorRGB(0.13, 0.73, 0.38)
    pdf.circle(x + size / 2, y + size / 2, size / 2, fill=1, stroke=0)
    pdf.setStrokeColorRGB(1, 1, 1)
    pdf.setFillColorRGB(1, 1, 1)
    pdf.setLineWidth(max(2.2, size * 0.08))
    pdf.setLineCap(1)
    pdf.setLineJoin(1)
    path = pdf.beginPath()
    path.moveTo(x + size * 0.26, y + size * 0.50)
    path.lineTo(x + size * 0.44, y + size * 0.32)
    path.lineTo(x + size * 0.76, y + size * 0.70)
    pdf.drawPath(path, stroke=1, fill=0)


def apply_completed_signature_marks(pdf_bytes: bytes) -> bytes:
    """Add the green Aadhaar tick after Digio has signed. Never call this on the unsigned preview."""
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
    try:
        for index, x, y, size in _COMPLETED_TICKS:
            if index >= len(reader.pages):
                continue
            stream = BytesIO()
            page = reader.pages[index]
            width = float(page.mediabox.width)
            height = float(page.mediabox.height)
            pdf = canvas.Canvas(stream, pagesize=(width, height))
            _draw_green_tick(pdf, x, y, size)
            pdf.showPage()
            pdf.save()
            overlays[index] = stream.getvalue()

        for index, page in enumerate(reader.pages):
            overlay = overlays.get(index)
            if overlay:
                page.merge_page(PdfReader(BytesIO(overlay)).pages[0])
            writer.add_page(page)
        if reader.metadata:
            writer.add_metadata(
                {str(key): str(value) for key, value in dict(reader.metadata).items()}
            )
        output = BytesIO()
        writer.write(output)
        return output.getvalue()
    except Exception:
        return pdf_bytes


def _replace(
    pdf: canvas.Canvas,
    *,
    x: float,
    top: float,
    width: float,
    text: str,
    height: float = 14,
    font: str = "Helvetica",
    size: float = 8.5,
) -> None:
    _cover(pdf, x, top, width, height)
    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont(font, _fit_text(str(text), width - 4, font=font, size=size))
    pdf.drawString(x + 2, _from_top(top + height) + 3, str(text))


def _replace_wrapped(
    pdf: canvas.Canvas,
    *,
    x: float,
    top: float,
    width: float,
    height: float,
    text: str,
    font: str = "Helvetica",
    size: float = 8,
) -> None:
    _cover(pdf, x, top, width, height)
    pdf.setFillColorRGB(0, 0, 0)
    words = str(text or "—").split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if stringWidth(candidate, font, size) <= width - 4 or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    y = _from_top(top + 11)
    for line in lines[:4]:
        pdf.setFont(font, size)
        pdf.drawString(x + 2, y, line)
        y -= 11


def _overlay_for_page(index: int, values: AgreementValues) -> bytes:
    stream = BytesIO()
    pdf = canvas.Canvas(stream, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    _wipe_sample_signature(pdf, index)
    _draw_brand_logo(pdf)

    if index == 8:
        details_x = 304
        details_w = 248
        _replace(pdf, x=details_x, top=160, width=details_w, text=values.borrower_name, height=16)
        _replace_wrapped(
            pdf,
            x=details_x,
            top=182,
            width=details_w,
            height=32,
            text=values.address,
        )
        _replace_wrapped(
            pdf,
            x=details_x,
            top=218,
            width=details_w,
            height=48,
            text=values.address,
        )
        _replace(pdf, x=details_x, top=270, width=details_w, text=values.pan, height=16)
        _replace(pdf, x=details_x, top=292, width=details_w, text=values.email, height=30)
        _replace(pdf, x=details_x, top=328, width=details_w, text=values.mobile, height=16)
        _replace(pdf, x=details_x, top=413, width=details_w, text=values.execution_date, height=16)
        _replace(pdf, x=details_x, top=435, width=details_w, text=values.application_number, height=16)
        _replace(pdf, x=details_x, top=458, width=details_w, text=values.sanction_date, height=16)
        _replace(pdf, x=details_x, top=480, width=details_w, text=values.principal, height=16)
        _replace(pdf, x=details_x, top=503, width=details_w, text=values.interest_rate, height=16)
        _replace(pdf, x=details_x, top=525, width=details_w, text=values.processing_fee, height=16)
        _replace(pdf, x=details_x, top=548, width=details_w, text=values.gst, height=16)
        _replace(pdf, x=details_x, top=570, width=details_w, text=values.disbursal_amount, height=16)
        _replace(pdf, x=details_x, top=592, width=details_w, text=values.repayment_date, height=16)
        _replace(pdf, x=details_x, top=615, width=details_w, text=values.repayment_amount, height=16)
        _replace(pdf, x=details_x, top=637, width=details_w, text=values.tenure_days, height=16)
        _replace(pdf, x=details_x, top=696, width=details_w, text=values.borrower_name, height=16)
    elif index == 9:
        _replace(pdf, x=238, top=122, width=72, text=values.application_number, height=14, size=7.5)
        _replace(
            pdf,
            x=238,
            top=140,
            width=72,
            text=values.principal.replace("Rs.", "₹"),
            height=14,
            size=7.5,
        )
        _replace(
            pdf,
            x=238,
            top=236,
            width=90,
            text=f"Loan tenure – {values.tenure_days.replace(' Days', ' days')}",
            height=16,
            size=7.5,
        )
        _replace(
            pdf,
            x=286,
            top=286,
            width=50,
            text=values.repayment_amount.replace("Rs.", "₹"),
            height=14,
            size=7.5,
        )
        _replace(
            pdf,
            x=238,
            top=308,
            width=130,
            text=f"{values.interest_rate} – Fixed",
            height=14,
            size=7.5,
        )
        _replace(
            pdf,
            x=286,
            top=456,
            width=50,
            text=values.processing_fee.replace("Rs. ", "₹ "),
            height=12,
            size=7,
        )
        _replace(pdf, x=238, top=523, width=130, text=values.apr, height=14, size=7)
        _replace(pdf, x=438, top=568, width=50, text=values.late_interest_rate, height=14, size=7)

    pdf.showPage()
    pdf.save()
    return stream.getvalue()


def _strip_form(writer: PdfWriter) -> None:
    root = getattr(writer, "_root_object", None)
    if root is not None and "/AcroForm" in root:
        del root["/AcroForm"]
    for page in writer.pages:
        if page.get("/Annots") is not None:
            del page["/Annots"]


def build_agreement_pdf(*, lead) -> bytes:
    """Return the 10-page template with KNM logo and the lead's blanks filled in."""
    if not TEMPLATE_PATH.is_file():
        raise FileNotFoundError(f"Agreement template not found: {TEMPLATE_PATH}")

    values = _agreement_values(lead)
    reader = PdfReader(str(TEMPLATE_PATH))
    writer = PdfWriter()
    for index, page in enumerate(reader.pages):
        overlay = _overlay_for_page(index, values)
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
