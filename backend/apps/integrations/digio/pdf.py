"""Create an unsigned, lead-specific agreement from the 10-page KNM template."""

from __future__ import annotations

import threading
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

# CRM palette (frontend/src/index.css).
BRAND_PRIMARY = (0x2A / 255, 0x2D / 255, 0x4F / 255)  # primary-deep
BRAND_HAIRLINE = (0xB0 / 255, 0xB0 / 255, 0xC1 / 255)
INK = (0.12, 0.13, 0.18)
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

# Footer geometry matches the template. The wordmark is bold "Kuberniti Money"
# text; knm-logo.png is used once, inside the centre footer cell.
_FOOTER_WIPE_TOP = 786.0
_FOOTER_LEFT = 30.25
_FOOTER_RIGHT = 564.95
_FOOTER_DIVIDER_LEFT = 233.88
_FOOTER_DIVIDER_RIGHT = 361.96
_FOOTER_RULE_TOP = 810.59
_FOOTER_RULE_BOTTOM = 843.89
_FOOTER_RULE_THICKNESS = 1.28
_WORDMARK = "Kuberniti Money"
_LEGAL_ENTITY = "Har Shreejee Finance and Leasing Co. Ltd."
_REGISTER_L1 = "Register Office - Plot No 9, Office No 202, 2nd Floor, Chourdhary Complex,"
_REGISTER_L2 = "Madhuban Road, V.S. Block, Delhi - 110092"
_CORPORATE = "Corporate Office - WZ-3 meenakshi garden, tilak nagar 110018"

# Reserved Digio stamp areas, measured from the top of the page. Kept above the
# footer band and off the Schedule 1 table. The green tick is overlaid on the
# stamp after eSign — not drawn in a separate column.
_SIGNATURE_CARDS = {
    7: (385.0, 318.0, 175.0, 82.0),  # under "Borrower Signature & Date"
    8: (412.0, 718.0, 168.0, 72.0),  # gap between Schedule 1 and the footer
    9: (412.0, 718.0, 168.0, 72.0),
}


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

_LOGO: tuple[bytes, float] | None = None
_LOGO_READY = False
_WHITE_PNG: bytes | None = None
_BRANDED_TEMPLATE: bytes | None = None
_BRANDED_LOCK = threading.Lock()
_DATA_PAGES = frozenset({8, 9})


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


def _latest_address(customer):
    if customer is None:
        return None
    return CustomerAddress.objects.filter(customer=customer).order_by("-created_at").first()


def _customer_address(customer) -> str:
    address = _latest_address(customer)
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


def _fit_text(text: str, width: float, *, font: str = "Times-Roman", size: float = 9) -> float:
    while size > 6 and stringWidth(text, font, size) > width:
        size -= 0.5
    return size


def _logo_path() -> Path | None:
    # The print asset carries the dark wordmark; the email logo is white-on-transparent
    # and would be invisible on paper.
    candidates = (
        ASSET_DIR / "knm-logo.png",
        Path(getattr(settings, "EMAIL_LOGO_PATH", "") or ""),
        Path(getattr(settings, "BASE_DIR", "")) / "static" / "emails" / "logo.png",
    )
    return next((path for path in candidates if path.is_file()), None)


def _crop_opaque(image: Image.Image, *, pad: int = 2) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    return image.crop(
        (
            max(0, left - pad),
            max(0, top - pad),
            min(image.width, right + pad),
            min(image.height, bottom + pad),
        )
    )


def _png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _load_brand_images() -> None:
    """Cache knm-logo.png for the centre footer cell."""
    global _LOGO, _LOGO_READY
    if _LOGO_READY:
        return
    _LOGO_READY = True
    path = _logo_path()
    if path is None:
        return
    image = _crop_opaque(Image.open(path).convert("RGBA"))
    _LOGO = (_png_bytes(image), image.width / image.height)


def _logo_image() -> tuple[bytes, float] | None:
    _load_brand_images()
    return _LOGO


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


def _draw_centered_text(
    pdf: canvas.Canvas,
    text: str,
    *,
    top: float,
    font: str,
    size: float,
    color=INK,
) -> None:
    pdf.setFillColorRGB(*color)
    pdf.setFont(font, size)
    pdf.drawCentredString(PAGE_WIDTH / 2, _from_top(top + size), text)


def _draw_footer_brand(pdf: canvas.Canvas) -> None:
    """Redraw the footer: bold wordmark, one knm-logo.png in the centre cell, CRM navy rules."""
    _cover_image(pdf, 0, _FOOTER_WIPE_TOP, PAGE_WIDTH, PAGE_HEIGHT - _FOOTER_WIPE_TOP)
    # Sample Aadhaar stamps sit at y≈765 on the right; body copy on page 2 ends at y≈762.
    _cover_image(pdf, 430, 764, 165, 24)

    _draw_centered_text(
        pdf,
        _WORDMARK,
        top=789.2,
        font="Times-Bold",
        size=9.2,
        color=BRAND_PRIMARY,
    )
    _draw_centered_text(
        pdf,
        _LEGAL_ENTITY,
        top=800.0,
        font="Times-Roman",
        size=6.4,
        color=BRAND_PRIMARY,
    )

    left, right = _FOOTER_LEFT, _FOOTER_RIGHT
    rule_y = _from_top(_FOOTER_RULE_TOP + _FOOTER_RULE_THICKNESS)
    bottom_y = _from_top(_FOOTER_RULE_BOTTOM + _FOOTER_RULE_THICKNESS)
    band_height = _FOOTER_RULE_BOTTOM - _FOOTER_RULE_TOP
    pdf.setFillColorRGB(*BRAND_PRIMARY)
    pdf.rect(left, rule_y, right - left, _FOOTER_RULE_THICKNESS, fill=1, stroke=0)
    pdf.rect(left, bottom_y, right - left, _FOOTER_RULE_THICKNESS, fill=1, stroke=0)
    pdf.setFillColorRGB(*BRAND_HAIRLINE)
    for x in (left, _FOOTER_DIVIDER_LEFT, _FOOTER_DIVIDER_RIGHT, right):
        pdf.rect(x, bottom_y, 0.45, band_height + _FOOTER_RULE_THICKNESS, fill=1, stroke=0)

    image = _logo_image()
    if image:
        logo, ratio = image
        pad = 4.0
        max_w = _FOOTER_DIVIDER_RIGHT - _FOOTER_DIVIDER_LEFT - 2 * pad
        max_h = band_height - 2 * pad
        width = max_w
        height = width / ratio
        if height > max_h:
            height = max_h
            width = height * ratio
        logo_x = (_FOOTER_DIVIDER_LEFT + _FOOTER_DIVIDER_RIGHT - width) / 2
        logo_top = _FOOTER_RULE_TOP + (band_height - height) / 2
        pdf.drawImage(
            ImageReader(BytesIO(logo)),
            logo_x,
            _from_top(logo_top + height),
            width=width,
            height=height,
            preserveAspectRatio=True,
            mask="auto",
            anchor="sw",
        )

    pdf.setFillColorRGB(*INK)
    pdf.setFont("Times-Roman", 5.8)
    pdf.drawString(37.0, _from_top(827.1), _REGISTER_L1)
    pdf.drawString(78.0, _from_top(834.8), _REGISTER_L2)
    pdf.drawString(_FOOTER_DIVIDER_RIGHT + 8, _from_top(831.0), _CORPORATE)


def _wipe_sample_signature(pdf: canvas.Canvas, index: int) -> None:
    """Blank leftover Digio stamps. The signed mark is applied only after eSign completes."""
    _cover_image(pdf, 430, 764, 165, 24)
    if index == 7:
        # Keep "Borrower Signature & Date"; hide the sample signed-by block under it.
        _cover_image(pdf, 380, 360, 200, 60)


def _draw_green_tick(pdf: canvas.Canvas, x: float, y: float, size: float) -> None:
    """Fill the tick-mark outline in a box `size` wide, anchored bottom-left."""
    height = size / _TICK_RATIO

    def at(point: tuple[float, float]) -> tuple[float, float]:
        return x + point[0] * size, y + point[1] * height

    pdf.setFillColorRGB(*SIGNATURE_GREEN)
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
    """Times-Italic block with a green tick. This replaces Digio's visible stamp."""
    _cover_image(pdf, x - 4, top - 2, width + 8, height + 6)
    name = signer_name or "Customer"
    location = signer_location or "New Delhi"
    lines = (
        "Digitally Signed by:",
        f"Name: {name}",
        f"Location: {location}",
        "Reason: Loan Agreement",
        f"Date: {signed_at}",
    )
    size = 8.0 if height >= 72 else 7.2
    leading = 10.0 if height >= 72 else 9.0
    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont("Times-Italic", size)
    text_y = _from_top(top + 11)
    for line in lines:
        pdf.drawString(x + 6, text_y, line)
        text_y -= leading

    tick_w = min(width * 0.62, 56.0)
    tick_h = tick_w / _TICK_RATIO
    _draw_green_tick(
        pdf,
        x + width * 0.08,
        _from_top(top + height) + (height - tick_h) / 2,
        tick_w,
    )


def apply_completed_signature_marks(
    pdf_bytes: bytes,
    *,
    signer_name: str = "",
    signer_location: str = "",
    signed_at: datetime | None = None,
) -> bytes:
    """Replace Digio's visible stamp with the five-line Times-Italic block and tick."""
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


def _replace(
    pdf: canvas.Canvas,
    *,
    x: float,
    top: float,
    width: float,
    text: str,
    height: float = 14,
    font: str = "Times-Roman",
    size: float = 9,
) -> None:
    _cover(pdf, x, top, width, height)
    pdf.setFillColorRGB(*INK)
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
    font: str = "Times-Roman",
    size: float = 8,
) -> None:
    _cover(pdf, x, top, width, height)
    pdf.setFillColorRGB(*INK)
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


def _branding_overlay_bytes(index: int) -> bytes:
    stream = BytesIO()
    pdf = canvas.Canvas(stream, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    _wipe_sample_signature(pdf, index)
    _draw_footer_brand(pdf)
    pdf.showPage()
    pdf.save()
    return stream.getvalue()


def _branded_template_bytes() -> bytes:
    """Template with KNM logo and sample-signature wipes (built once per process)."""
    global _BRANDED_TEMPLATE
    if _BRANDED_TEMPLATE is not None:
        return _BRANDED_TEMPLATE
    with _BRANDED_LOCK:
        if _BRANDED_TEMPLATE is not None:
            return _BRANDED_TEMPLATE
        if not TEMPLATE_PATH.is_file():
            raise FileNotFoundError(f"Agreement template not found: {TEMPLATE_PATH}")
        reader = PdfReader(str(TEMPLATE_PATH))
        writer = PdfWriter()
        for index, page in enumerate(reader.pages):
            overlay = _branding_overlay_bytes(index)
            page.merge_page(PdfReader(BytesIO(overlay)).pages[0])
            writer.add_page(page)
        _strip_form(writer)
        output = BytesIO()
        writer.write(output)
        _BRANDED_TEMPLATE = output.getvalue()
        return _BRANDED_TEMPLATE


def _overlay_for_page(index: int, values: AgreementValues) -> bytes:
    """Stamp lead-specific blanks onto a branded template page."""
    stream = BytesIO()
    pdf = canvas.Canvas(stream, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))

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
        _replace(
            pdf, x=details_x, top=435, width=details_w, text=values.application_number, height=16
        )
        _replace(pdf, x=details_x, top=458, width=details_w, text=values.sanction_date, height=16)
        _replace(pdf, x=details_x, top=480, width=details_w, text=values.principal, height=16)
        _replace(pdf, x=details_x, top=503, width=details_w, text=values.interest_rate, height=16)
        _replace(pdf, x=details_x, top=525, width=details_w, text=values.processing_fee, height=16)
        _replace(pdf, x=details_x, top=548, width=details_w, text=values.gst, height=16)
        _replace(
            pdf, x=details_x, top=570, width=details_w, text=values.disbursal_amount, height=16
        )
        _replace(pdf, x=details_x, top=592, width=details_w, text=values.repayment_date, height=16)
        _replace(
            pdf, x=details_x, top=615, width=details_w, text=values.repayment_amount, height=16
        )
        _replace(pdf, x=details_x, top=637, width=details_w, text=values.tenure_days, height=16)
        _replace(pdf, x=details_x, top=696, width=details_w, text=values.borrower_name, height=16)
    elif index == 9:
        _replace(
            pdf,
            x=238,
            top=122,
            width=72,
            text=values.application_number,
            height=14,
            size=8,
        )
        _replace(
            pdf,
            x=238,
            top=140,
            width=72,
            text=values.principal.replace("Rs.", "₹"),
            height=14,
            size=8,
        )
        _replace(
            pdf,
            x=238,
            top=236,
            width=90,
            text=f"Loan tenure – {values.tenure_days.replace(' Days', ' days')}",
            height=16,
            size=8,
        )
        _replace(
            pdf,
            x=286,
            top=286,
            width=50,
            text=values.repayment_amount.replace("Rs.", "₹"),
            height=14,
            size=8,
        )
        _replace(
            pdf,
            x=238,
            top=308,
            width=130,
            text=f"{values.interest_rate} – Fixed",
            height=14,
            size=8,
        )
        _replace(
            pdf,
            x=286,
            top=456,
            width=50,
            text=values.processing_fee.replace("Rs. ", "₹ "),
            height=12,
            size=7.5,
        )
        _replace(pdf, x=238, top=523, width=130, text=values.apr, height=14, size=7.5)
        _replace(pdf, x=438, top=568, width=50, text=values.late_interest_rate, height=14, size=7.5)

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
    values = _agreement_values(lead)
    reader = PdfReader(BytesIO(_branded_template_bytes()))
    writer = PdfWriter()
    for index, page in enumerate(reader.pages):
        if index in _DATA_PAGES:
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
