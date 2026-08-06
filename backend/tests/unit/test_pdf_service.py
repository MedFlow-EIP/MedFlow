"""Unit tests for the PDF extraction service."""
import io
import pytest
from services.pdf import extract_text_from_pdf


def _make_pdf_bytes(text: str = "Hello PDF") -> bytes:
    """Build a minimal valid PDF containing the given text string."""
    # We use PyPDF2 to create a real in-memory PDF for testing.
    import PyPDF2
    from PyPDF2 import PdfWriter
    writer = PdfWriter()
    # Add a blank page — we can't easily add text without reportlab,
    # but we can test the extraction path even with an empty page.
    writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def test_extract_text_returns_string():
    pdf_bytes = _make_pdf_bytes()
    result = extract_text_from_pdf(pdf_bytes)
    assert isinstance(result, str)


def test_extract_text_from_corrupted_pdf_raises():
    with pytest.raises(Exception):
        extract_text_from_pdf(b"this is not a pdf at all $$$$")


def test_extract_text_from_empty_bytes_raises():
    with pytest.raises(Exception):
        extract_text_from_pdf(b"")


def test_extract_text_minimal_pdf(minimal_pdf_bytes):
    """extract_text_from_pdf should not raise on a minimal valid PDF."""
    result = extract_text_from_pdf(minimal_pdf_bytes)
    assert isinstance(result, str)
