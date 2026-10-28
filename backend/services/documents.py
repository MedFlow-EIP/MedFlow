"""Lecture des documents importés comme cours : PDF, Word, PowerPoint, images.

Word et PowerPoint sont des archives ZIP de XML : on lit le texte directement,
sans dépendance supplémentaire. Les images et les PDF scannés (sans texte) sont
lus par l'IA (``transcribe_document``).
"""
import logging
import re
import zipfile
from io import BytesIO
from xml.etree import ElementTree

logger = logging.getLogger(__name__)

# Extension -> type MIME envoyé au modèle.
DOCUMENT_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Une archive Office de quelques Mo peut se décompresser en centaines de Mo
# (« zip bomb ») : on plafonne ce qu'on accepte de lire.
MAX_UNZIPPED_BYTES = 50 * 1024 * 1024

_W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
_A_NS = "{http://schemas.openxmlformats.org/drawingml/2006/main}"


class DocumentError(ValueError):
    """Document illisible : ``message`` est montré tel quel à l'utilisateur."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def _open_archive(data: bytes) -> zipfile.ZipFile:
    try:
        archive = zipfile.ZipFile(BytesIO(data))
    except zipfile.BadZipFile:
        raise DocumentError("Fichier illisible ou corrompu")
    if sum(info.file_size for info in archive.infolist()) > MAX_UNZIPPED_BYTES:
        raise DocumentError("Document trop volumineux une fois décompressé")
    return archive


def _xml_texts(xml: bytes, paragraph_tag: str, text_tag: str) -> list[str]:
    try:
        root = ElementTree.fromstring(xml)
    except ElementTree.ParseError:
        raise DocumentError("Fichier illisible ou corrompu")
    lines = []
    for paragraph in root.iter(paragraph_tag):
        line = "".join(node.text or "" for node in paragraph.iter(text_tag)).strip()
        if line:
            lines.append(line)
    return lines


def extract_text_from_docx(data: bytes) -> str:
    archive = _open_archive(data)
    try:
        xml = archive.read("word/document.xml")
    except KeyError:
        raise DocumentError("Ce fichier n'est pas un document Word valide")
    return "\n".join(_xml_texts(xml, f"{_W_NS}p", f"{_W_NS}t"))


def _slide_number(name: str) -> int:
    match = re.search(r"slide(\d+)\.xml$", name)
    return int(match.group(1)) if match else 0


def extract_text_from_pptx(data: bytes) -> str:
    archive = _open_archive(data)
    slides = sorted(
        (n for n in archive.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)),
        key=_slide_number,
    )
    if not slides:
        raise DocumentError("Ce fichier n'est pas une présentation PowerPoint valide")
    parts = []
    for index, name in enumerate(slides, start=1):
        lines = _xml_texts(archive.read(name), f"{_A_NS}p", f"{_A_NS}t")
        if lines:
            parts.append(f"Diapositive {index}\n" + "\n".join(lines))
    return "\n\n".join(parts)
