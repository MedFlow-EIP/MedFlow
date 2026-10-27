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


def pdf_has_images(pdf_file: bytes) -> bool:
    """Vrai si une page contient une image (schéma, figure, photo)."""
    try:
        for page in PdfReader(BytesIO(pdf_file)).pages:
            resources = page.get("/Resources")
            xobjects = resources.get_object().get("/XObject") if resources else None
            if not xobjects:
                continue
            for ref in xobjects.get_object().values():
                if ref.get_object().get("/Subtype") == "/Image":
                    return True
    except Exception:
        logger.warning("Analyse des images du PDF impossible", exc_info=True)
    return False


def pdf_page_count(pdf_file: bytes):
    """Nombre de pages, ou None si le PDF est illisible."""
    try:
        return len(PdfReader(BytesIO(pdf_file)).pages)
    except Exception:
        return None
