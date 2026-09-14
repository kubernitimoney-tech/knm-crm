"""Create an unsigned, lead-specific agreement from the approved 28-page template."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from django.utils import timezone
from pypdf import PdfReader, PdfWriter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from apps.customers.models import CustomerAddress
from apps.customers.services.customer_service import CustomerService

ASSET_DIR = Path(__file__).resolve().parent / "assets"
TEMPLATE_PATH = ASSET_DIR / "loan-agreement-static.pdf"
PAGE_WIDTH = 595.304
PAGE_HEIGHT = 841.89
PAGE_BACKGROUNDS = {index: ASSET_DIR / f"agreement-page-{index + 1:02d}.jpg" for index in range(28)}


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
    return f"Rs. {amount:,.2f} /-"


def _date(value) -> str:
    if not value:
        return "—"
    if isinstance(value, datetime):
        value = timezone.localtime(value).date() if timezone.is_aware(value) else value.date()
    if isinstance(value, date):
        day = value.day
        suffix = "th" if 10 < day % 100 < 14 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        return value.strftime(f"{day}{suffix} %b, %Y")
    try:
        return _date(date.fromisoformat(str(value)[:10]))
    except ValueError:
        return str(value)


def _decimal(value, default: Decimal = Decimal("0")) -> Decimal:
    try:
        return Decimal(str(value))
    except Exception:
        return default


def _first_value(mapping: dict, *keys: str):
    for key in keys:
        value = mapping.get(key)
        if value not in (None, ""):
            return value
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
        disbursal = max(
            Decimal("0"), _decimal(principal) - _decimal(processing_fee) - _decimal(gst)
        )
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
        interest_rate=f"{_decimal(interest):g} % Per Day",
        processing_fee=_money(processing_fee),
        gst=_money(gst),
        disbursal_amount=_money(disbursal),
        repayment_date=_date(repayment_at),
        repayment_amount=_money(repayment),
        tenure_days=f"{tenure} days",
        apr=f"{_decimal(apr):g}",
        cooling_off_days=f"{_first_value(details, 'cooling_off_days') or 3} Days",
        late_interest_rate=f"{_first_value(details, 'late_interest_rate') or '1.25'}% per Day",
    )


def _fit_text(text: str, width: float, *, font: str = "Helvetica", size: float = 9) -> float:
    while size > 6 and stringWidth(text, font, size) > width:
        size -= 0.5
    return size


def _replace(
    pdf: canvas.Canvas,
    *,
    x: float,
    y: float,
    width: float,
    text: str,
    height: float = 16,
    font: str = "Helvetica",
    size: float = 9,
) -> None:
    pdf.setFillColorRGB(1, 1, 1)
    pdf.rect(x, y - 4, width, height, fill=1, stroke=0)
    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont(font, _fit_text(str(text), width - 4, font=font, size=size))
    pdf.drawString(x + 2, y, str(text))


def _whiteout(pdf: canvas.Canvas, x: float, y: float, width: float, height: float) -> None:
    pdf.setFillColorRGB(1, 1, 1)
    pdf.rect(x, y, width, height, fill=1, stroke=0)


def _draw_wrapped(
    pdf: canvas.Canvas,
    text: str,
    *,
    x: float,
    y: float,
    width: float,
    size: float = 11,
    leading: float = 28,
) -> None:
    words = text.split()
    lines: list[str] = []
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if stringWidth(candidate, "Times-Roman", size) <= width:
            line = candidate
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont("Times-Roman", size)
    for item in lines:
        pdf.drawString(x, y, item)
        y -= leading


def _draw_laxmi_branding(pdf: canvas.Canvas, index: int) -> None:
    blue = (0.04, 0.25, 0.52)

    # Replace the NCPL logo and Naman banner on every page.
    _whiteout(pdf, 28, 775, 190, 55)
    pdf.setFillColorRGB(*blue)
    pdf.setFont("Helvetica-Bold", 30)
    pdf.drawString(36, 793, "LAXMI")
    _whiteout(pdf, 280, 775, 315, 52)
    pdf.setFillColorRGB(*blue)
    pdf.rect(300, 797, 295, 22, fill=1, stroke=0)
    pdf.setFillColorRGB(1, 1, 1)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawCentredString(447, 803, "LAXMI")

    # Replace the NCPL website in the common footer.
    _whiteout(pdf, 338, 88, 155, 26)
    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(354, 98, "LAXMI")

    replacements: dict[int, list[tuple[float, float, float, str]]] = {
        0: [(66, 627, 470, "M/s LAXMI, having its registered address in GF")],
        4: [
            (72, 644, 470, "LAXMI, a company incorporated under the laws of India and"),
            (72, 540, 470, "conditions to the potential customer referred to by LAXMI."),
            (99, 405, 440, "are tied to the loan offer accepted by the borrower of LAXMI."),
            (
                99,
                389,
                440,
                "The loan offer terms (agreement execution date, loan, sanction date, amount",
            ),
        ],
        5: [
            (126, 383, 410, "LAXMI (LendingRupee) will also accept payment"),
            (126, 321, 410, "that it shall provide NACH document to LAXMI"),
        ],
        6: [
            (
                126,
                686,
                410,
                "amount/interest or charges/fees associated with the loan, further LAXMI",
            ),
            (126, 670, 410, "(LendingRupee) shall not be held liable for the same."),
            (126, 603, 410, "The records maintained by LAXMI shall be"),
        ],
        15: [
            (95, 729, 440, "LAXMI, an RBI registered NBFC, follows extant rules"),
            (95, 666, 440, "The course of action adopted by LAXMI post default by the"),
            (117, 555, 415, "LAXMI has an in-house recovery team whose members are"),
        ],
        19: [
            (68, 711, 470, "The repayment schedule/payment advice that you receive from LAXMI"),
            (68, 695, 470, "is a document that helps you to know the repayment dates."),
            (68, 679, 470, "You must pay interest, principal and applicable charges to LAXMI"),
            (68, 663, 470, "for the loan availed and meet all obligations in a timely manner."),
        ],
    }
    page_replacements = replacements.get(index, [])
    for x, y, width, _text in page_replacements:
        _whiteout(pdf, x, y - 5, width, 18)
    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont("Times-Roman", 12)
    for x, y, width, text in page_replacements:
        pdf.setFont("Times-Roman", _fit_text(text, width - 4, font="Times-Roman", size=12))
        pdf.drawString(x + 2, y, text)


def _overlay_for_page(index: int, values: AgreementValues) -> bytes:
    stream = BytesIO()
    pdf = canvas.Canvas(stream, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    background = PAGE_BACKGROUNDS.get(index)
    if background:
        pdf.drawImage(
            str(background),
            0,
            0,
            width=PAGE_WIDTH,
            height=PAGE_HEIGHT,
            preserveAspectRatio=False,
        )

    _draw_laxmi_branding(pdf, index)

    if index == 0:
        _replace(
            pdf,
            x=123,
            y=416,
            width=105,
            text=f"(Rupees {values.principal.removeprefix('Rs. ').removesuffix(' /-')} only)",
            height=18,
            font="Times-Roman",
            size=11,
        )
    elif index == 21:
        for y, text in zip(
            (671, 646, 622, 597, 573),
            (values.borrower_name, values.address, values.pan, values.email, values.mobile),
            strict=True,
        ):
            _replace(pdf, x=301, y=y, width=225, text=text)
        for y, text in zip(
            (497, 472, 448, 423, 399, 374, 350, 325),
            (
                values.execution_date,
                values.application_number,
                values.sanction_date,
                values.principal,
                values.interest_rate,
                values.processing_fee,
                values.gst,
                values.disbursal_amount,
            ),
            strict=True,
        ):
            _replace(pdf, x=301, y=y, width=225, text=text)
    elif index == 22:
        for y, text in zip(
            (745, 721, 696, 672, 647),
            (
                values.repayment_date,
                values.repayment_amount,
                values.tenure_days,
                "Rs. 1,000.00 + GST",
                values.late_interest_rate,
            ),
            strict=True,
        ):
            _replace(pdf, x=301, y=y, width=225, text=text)
    elif index == 23:
        _whiteout(pdf, 370, 668, 165, 40)
        for y, text in (
            (521, values.borrower_name),
            (496, values.address),
            (350, values.pan),
            (322, values.email),
            (294, values.mobile),
            (266, values.application_number),
            (242, values.execution_date),
        ):
            _replace(pdf, x=283, y=y, width=235, text=text)
    elif index == 24:
        for y, text in (
            (745, values.principal),
            (720, values.processing_fee),
            (695, "18%"),
            (669, values.gst),
            (644, values.disbursal_amount),
            (615, values.repayment_amount),
            (586, values.repayment_date),
            (557, values.interest_rate.replace(" % Per Day", "")),
            (528, values.cooling_off_days),
            (499, values.apr),
            (476, values.tenure_days.replace(" days", "")),
            (451, values.late_interest_rate),
            (422, "Rs. 1,000.00 /-"),
        ):
            _replace(pdf, x=342, y=y, width=180, text=text, font="Helvetica-Bold")
    elif index == 25:
        _replace(
            pdf,
            x=399,
            y=743,
            width=135,
            text=f"DATE: {values.execution_date}",
            height=18,
            font="Times-Bold",
            size=10,
        )
        _whiteout(pdf, 68, 512, 470, 190)
        declaration = (
            f"I, {values.borrower_name}, hereinafter referred to as “Borrower”, bearing "
            f"Application number {values.application_number}, have taken a personal loan from "
            "Lending Rupee, a unit of LAXMI, hereinafter "
            "referred to as “Lender”, do hereby solemnly affirm, declare, and undertake that "
            "I shall repay the entire loan amount availed under this Agreement, together with "
            "all applicable interest, charges, and other dues, strictly in accordance with the "
            "terms and timelines agreed herein, without any delay or default."
        )
        _draw_wrapped(pdf, declaration, x=72, y=678, width=445, size=11, leading=24.5)
    elif index == 27:
        _whiteout(pdf, 300, 514, 160, 42)

    pdf.showPage()
    pdf.save()
    return stream.getvalue()


def build_agreement_pdf(*, lead) -> bytes:
    """Return the unsigned template personalized with the current lead's sanctioned values."""
    if not TEMPLATE_PATH.is_file():
        raise FileNotFoundError(f"Agreement template not found: {TEMPLATE_PATH}")

    values = _agreement_values(lead)
    reader = PdfReader(str(TEMPLATE_PATH))
    writer = PdfWriter()
    for index, page in enumerate(reader.pages):
        if index in PAGE_BACKGROUNDS:
            personalized_page = PdfReader(BytesIO(_overlay_for_page(index, values))).pages[0]
            writer.add_page(personalized_page)
            continue
        if "/Annots" in page:
            del page["/Annots"]
        writer.add_page(page)

    writer.add_metadata(
        {
            "/Title": f"Loan Agreement - {values.application_number}",
            "/Author": "LAXMI",
            "/Subject": f"Unsigned agreement for {values.borrower_name}",
        }
    )
    output = BytesIO()
    writer.write(output)
    return output.getvalue()
