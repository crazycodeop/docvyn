import io
import re
from typing import Dict, List, Optional, Tuple
from app.core.logging import logger

try:
    import pymupdf as fitz
    HAS_PYMUPDF = True
except ImportError:
    try:
        import fitz
        HAS_PYMUPDF = True
    except ImportError:
        HAS_PYMUPDF = False

try:
    import pypdf
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

try:
    import docx
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

try:
    from rapidocr_onnxruntime import RapidOCR
    HAS_RAPID_OCR = True
except ImportError:
    HAS_RAPID_OCR = False


class ExtractionError(Exception):
    pass


class CorruptFileError(ExtractionError):
    pass


class EmptyDocumentError(ExtractionError):
    pass


class ExtractedPage:
    def __init__(self, page_number: int, text: str, metadata: Optional[Dict] = None):
        self.page_number = page_number
        self.text = text
        self.metadata = metadata or {}


# Global singleton instance for OCR model
_rapid_ocr_instance: Optional["RapidOCR"] = None


def get_ocr_engine() -> Optional["RapidOCR"]:
    global _rapid_ocr_instance
    if _rapid_ocr_instance is None and HAS_RAPID_OCR:
        try:
            _rapid_ocr_instance = RapidOCR()
            logger.info("RapidOCR ONNX engine initialized.")
        except Exception as e:
            logger.warning(f"Could not initialize RapidOCR: {e}")
            _rapid_ocr_instance = None
    return _rapid_ocr_instance


class ExtractionService:
    @staticmethod
    def validate_file_content(file_bytes: bytes, filename: str) -> str:
        """Validates file magic bytes and returns normalized mime-type or raises error."""
        if not file_bytes or len(file_bytes) == 0:
            raise EmptyDocumentError("File content is completely empty.")

        ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

        if ext == "pdf":
            if not file_bytes.startswith(b"%PDF-"):
                raise CorruptFileError("Invalid PDF header. File is not a valid PDF document.")
            return "application/pdf"
        elif ext == "docx":
            # DOCX files are zip archives starting with PK\x03\x04
            if not file_bytes.startswith(b"PK\x03\x04"):
                raise CorruptFileError("Invalid DOCX format. File is not a valid OpenXML document.")
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif ext == "png":
            if not file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
                raise CorruptFileError("Invalid PNG header. File is not a valid PNG image.")
            return "image/png"
        elif ext in ("jpg", "jpeg"):
            if not file_bytes.startswith(b"\xff\xd8\xff"):
                raise CorruptFileError("Invalid JPEG header. File is not a valid JPEG image.")
            return "image/jpeg"
        elif ext in ("tif", "tiff"):
            if not (file_bytes.startswith(b"II*\x00") or file_bytes.startswith(b"MM\x00*")):
                raise CorruptFileError("Invalid TIFF header. File is not a valid TIFF image.")
            return "image/tiff"
        else:
            raise ExtractionError(
                f"Unsupported file format: .{ext}. Supported formats are PDF, DOCX, PNG, JPEG, and TIFF."
            )

    @classmethod
    def extract(cls, file_bytes: bytes, filename: str) -> List[ExtractedPage]:
        """Extracts text page by page from PDF, DOCX, or standalone image files."""
        mime_type = cls.validate_file_content(file_bytes, filename)

        if mime_type == "application/pdf":
            return cls._extract_pdf(file_bytes)
        elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return cls._extract_docx(file_bytes)
        elif mime_type in ("image/png", "image/jpeg", "image/tiff"):
            return cls._extract_image(file_bytes, mime_type)
        else:
            raise ExtractionError(f"Unsupported mime-type: {mime_type}")

    @staticmethod
    def _clean_text(text: str) -> str:
        if not text:
            return ""
        # Remove null bytes and non-printable control characters except \n, \r, \t
        text = text.replace("\x00", "")
        text = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
        # Normalize multiple horizontal whitespaces
        text = re.sub(r"[ \t]+", " ", text)
        # Normalize excessive newlines
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @classmethod
    def _run_ocr_on_bytes(cls, img_bytes: bytes) -> Tuple[str, float]:
        """Runs RapidOCR on image bytes and returns (extracted_text, average_confidence)."""
        engine = get_ocr_engine()
        if not engine:
            logger.warning("RapidOCR engine is unavailable. Skipping OCR step.")
            return "", 0.0

        try:
            result, _ = engine(img_bytes)
            if not result:
                return "", 0.0

            lines = []
            scores = []
            for item in result:
                # Each item is [bounding_box, text, confidence]
                if len(item) >= 3:
                    text_line = item[1].strip()
                    conf = float(item[2])
                    if text_line:
                        lines.append(text_line)
                        scores.append(conf)

            full_text = cls._clean_text("\n".join(lines))
            avg_score = round(sum(scores) / len(scores), 3) if scores else 0.0
            return full_text, avg_score
        except Exception as e:
            logger.error(f"Error during OCR execution: {e}")
            return "", 0.0

    @classmethod
    def _extract_image(cls, file_bytes: bytes, mime_type: str) -> List[ExtractedPage]:
        """Extracts text from a standalone image using local RapidOCR."""
        text, avg_conf = cls._run_ocr_on_bytes(file_bytes)
        if not text:
            raise EmptyDocumentError("The image does not contain any readable text or OCR yielded no results.")

        return [
            ExtractedPage(
                page_number=1,
                text=text,
                metadata={
                    "char_count": len(text),
                    "extraction_method": "ocr_image",
                    "ocr_confidence": avg_conf,
                    "is_scanned": True,
                    "mime_type": mime_type,
                },
            )
        ]

    @classmethod
    def _extract_pdf(cls, file_bytes: bytes) -> List[ExtractedPage]:
        if HAS_PYMUPDF:
            return cls._extract_pdf_fitz(file_bytes)
        elif HAS_PYPDF:
            return cls._extract_pdf_pypdf(file_bytes)
        else:
            raise RuntimeError("Neither PyMuPDF nor pypdf is installed for PDF extraction.")

    @classmethod
    def _extract_pdf_fitz(cls, file_bytes: bytes) -> List[ExtractedPage]:
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
        except Exception as e:
            raise CorruptFileError(f"Failed to open PDF document: {e}")

        pages: List[ExtractedPage] = []
        total_text_length = 0

        try:
            for page_index in range(len(doc)):
                page = doc[page_index]
                page_text = page.get_text("text") or ""
                cleaned = cls._clean_text(page_text)

                # Heuristic: if page text is very short (< 40 characters), check if it's a scanned page
                extraction_method = "digital_pdf"
                ocr_confidence = 1.0
                is_scanned = False
                final_text = cleaned

                # If digital text density is low and page has drawings/images, perform OCR fallback
                if len(cleaned) < 40 and HAS_RAPID_OCR:
                    try:
                        # Render page at 200 DPI for high-accuracy OCR
                        pix = page.get_pixmap(dpi=200)
                        pix_bytes = pix.tobytes("png")
                        ocr_text, ocr_conf = cls._run_ocr_on_bytes(pix_bytes)

                        # If OCR yields more substantial text, use OCR result
                        if len(ocr_text) > len(cleaned):
                            final_text = ocr_text
                            extraction_method = "ocr_pdf"
                            ocr_confidence = ocr_conf
                            is_scanned = True
                    except Exception as ocr_err:
                        logger.warning(f"Failed OCR fallback on page {page_index + 1}: {ocr_err}")

                total_text_length += len(final_text)

                pages.append(
                    ExtractedPage(
                        page_number=page_index + 1,
                        text=final_text,
                        metadata={
                            "page_width": page.rect.width,
                            "page_height": page.rect.height,
                            "char_count": len(final_text),
                            "extraction_method": extraction_method,
                            "ocr_confidence": ocr_confidence,
                            "is_scanned": is_scanned,
                        },
                    )
                )
        except Exception as e:
            raise ExtractionError(f"Error extracting pages from PDF: {e}")
        finally:
            doc.close()

        if total_text_length == 0:
            raise EmptyDocumentError("The PDF document does not contain any readable text or is scanned without OCR.")

        return pages

    @classmethod
    def _extract_pdf_pypdf(cls, file_bytes: bytes) -> List[ExtractedPage]:
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        except Exception as e:
            raise CorruptFileError(f"Failed to open PDF document with pypdf: {e}")

        pages: List[ExtractedPage] = []
        total_text_length = 0

        try:
            for idx, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                cleaned = cls._clean_text(page_text)
                total_text_length += len(cleaned)

                pages.append(
                    ExtractedPage(
                        page_number=idx + 1,
                        text=cleaned,
                        metadata={
                            "char_count": len(cleaned),
                            "extraction_method": "digital_pdf",
                            "ocr_confidence": 1.0,
                            "is_scanned": False,
                        },
                    )
                )
        except Exception as e:
            raise ExtractionError(f"Error extracting pages with pypdf: {e}")

        if total_text_length == 0:
            raise EmptyDocumentError("The PDF document does not contain any readable text or is scanned without OCR.")

        return pages

    @classmethod
    def _extract_docx(cls, file_bytes: bytes) -> List[ExtractedPage]:
        if not HAS_DOCX:
            raise RuntimeError("python-docx is not installed.")

        try:
            doc = docx.Document(io.BytesIO(file_bytes))
        except Exception as e:
            raise CorruptFileError(f"Failed to open DOCX document: {e}")

        sections_text = []

        # 1. Extract Headers from sections
        for section in doc.sections:
            if section.header and section.header.paragraphs:
                header_text = " ".join(cls._clean_text(p.text) for p in section.header.paragraphs if p.text.strip())
                if header_text and header_text not in sections_text:
                    sections_text.append(f"**Header:** {header_text}")

        # 2. Extract Document Body with Headings Hierarchy & Paragraphs
        for p in doc.paragraphs:
            text = cls._clean_text(p.text)
            if not text:
                continue

            style_name = (p.style.name or "").lower() if p.style else ""
            if "heading 1" in style_name or style_name == "title":
                sections_text.append(f"# {text}")
            elif "heading 2" in style_name:
                sections_text.append(f"## {text}")
            elif "heading 3" in style_name:
                sections_text.append(f"### {text}")
            elif "heading 4" in style_name:
                sections_text.append(f"#### {text}")
            else:
                sections_text.append(text)

        # 3. Extract Tables as structured Markdown tables
        for table in doc.tables:
            markdown_table_rows = []
            for row_idx, row in enumerate(table.rows):
                # Clean cell texts, escaping any pipes to avoid breaking table layout
                cells = [cls._clean_text(cell.text).replace("|", "\\|").replace("\n", " ") for cell in row.cells]
                row_line = "| " + " | ".join(cells) + " |"
                markdown_table_rows.append(row_line)

                # Add markdown divider after header row
                if row_idx == 0:
                    divider_line = "| " + " | ".join(["---"] * len(cells)) + " |"
                    markdown_table_rows.append(divider_line)

            if markdown_table_rows:
                sections_text.append("\n".join(markdown_table_rows))

        # 4. Extract Footers from sections
        for section in doc.sections:
            if section.footer and section.footer.paragraphs:
                footer_text = " ".join(cls._clean_text(p.text) for p in section.footer.paragraphs if p.text.strip())
                if footer_text and footer_text not in sections_text:
                    sections_text.append(f"**Footer:** {footer_text}")

        full_text = "\n\n".join(sections_text)
        if not full_text.strip():
            raise EmptyDocumentError("The DOCX document is empty or has no text content.")

        # Estimate pages (approx ~3000 chars per page)
        chars_per_page = 3000
        pages: List[ExtractedPage] = []
        for i in range(0, max(1, len(full_text)), chars_per_page):
            chunk_slice = full_text[i : i + chars_per_page]
            page_num = (i // chars_per_page) + 1
            pages.append(
                ExtractedPage(
                    page_number=page_num,
                    text=chunk_slice,
                    metadata={
                        "char_count": len(chunk_slice),
                        "extraction_method": "docx",
                        "ocr_confidence": 1.0,
                        "is_scanned": False,
                    },
                )
            )

        return pages
