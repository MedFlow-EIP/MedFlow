import logging
from io import BytesIO

# pypdf : successeur maintenu de PyPDF2 (abandonné, failles non corrigées).
from pypdf import PdfReader

logger = logging.getLogger(__name__)


def extract_text_from_pdf(pdf_file: bytes) -> str:
    """Extract plain text from a PDF binary payload."""
    try:
        pdf_reader = PdfReader(BytesIO(pdf_file))
        text = ""
        for page in pdf_reader.pages:
            text += (page.extract_text() or "") + "\n"
        return text
    except Exception as e:
        logger.error(f"Erreur extraction PDF: {str(e)}")
        raise
