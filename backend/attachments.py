from io import BytesIO
from pathlib import PurePath
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile

from pypdf import PdfReader
from werkzeug.utils import secure_filename


MAX_FILE_BYTES = 6 * 1024 * 1024
MAX_EXTRACTED_CHARACTERS = 60_000
MAX_FILES_PER_MESSAGE = 4
ALLOWED_EXTENSIONS = {".csv", ".docx", ".json", ".md", ".pdf", ".txt"}


class AttachmentError(ValueError):
    pass


def extract_attachment(upload):
    original_name = upload.filename or "attachment"
    filename = secure_filename(original_name) or "attachment"
    extension = PurePath(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise AttachmentError(f"Unsupported file type. Allowed types: {allowed}.")

    content = upload.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise AttachmentError(f"{filename} is larger than the 6 MB per-file limit.")
    if not content:
        raise AttachmentError(f"{filename} is empty.")

    try:
        if extension == ".pdf":
            reader = PdfReader(BytesIO(content))
            if len(reader.pages) > 100:
                raise AttachmentError(f"{filename} has more than the 100-page limit.")
            pages = []
            total_characters = 0
            for page in reader.pages:
                page_text = page.extract_text() or ""
                pages.append(page_text)
                total_characters += len(page_text)
                if total_characters >= MAX_EXTRACTED_CHARACTERS:
                    break
            text = "\n\n".join(pages)
            if not text.strip():
                raise AttachmentError(f"No selectable text was found in {filename}.")
        elif extension == ".docx":
            text = _extract_docx(content, filename)
        else:
            try:
                text = content.decode("utf-8-sig")
            except UnicodeDecodeError as error:
                raise AttachmentError(f"{filename} must be a UTF-8 text file.") from error
    except AttachmentError:
        raise
    except (BadZipFile, ValueError, OSError) as error:
        raise AttachmentError(f"Could not read {filename}. Make sure the file is valid.") from error
    except Exception as error:
        raise AttachmentError(f"Could not read {filename}. Make sure the file is valid.") from error

    text = text.strip()
    if not text:
        raise AttachmentError(f"No text could be extracted from {filename}.")
    if len(text) > MAX_EXTRACTED_CHARACTERS:
        text = text[:MAX_EXTRACTED_CHARACTERS] + "\n[File text truncated at 60,000 characters.]"

    return {
        "filename": filename[:255],
        "content_type": upload.mimetype or "application/octet-stream",
        "byte_size": len(content),
        "extracted_text": text,
    }


def _extract_docx(content, filename):
    try:
        with ZipFile(BytesIO(content)) as archive:
            document_info = archive.getinfo("word/document.xml")
            if document_info.file_size > 8 * 1024 * 1024:
                raise AttachmentError(f"{filename} contains an oversized document body.")
            document = ElementTree.fromstring(archive.read(document_info))
    except (BadZipFile, KeyError, ElementTree.ParseError) as error:
        raise AttachmentError(f"{filename} is not a valid DOCX document.") from error

    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []
    for paragraph in document.findall(".//w:p", namespace):
        value = "".join(node.text or "" for node in paragraph.findall(".//w:t", namespace))
        if value:
            paragraphs.append(value)
    return "\n".join(paragraphs)
