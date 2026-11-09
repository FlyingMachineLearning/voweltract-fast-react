import io
import zipfile
from pathlib import Path
from pypdf import PdfReader
from docx import Document

MAX_TEXT = 100_000


def extract(name: str, data: bytes) -> str:
    suffix = Path(name).suffix.lower()
    if suffix in {".txt", ".md"}:
        return data.decode("utf-8-sig")
    if suffix == ".pdf":
        reader = PdfReader(io.BytesIO(data))
        if len(reader.pages) > 300:
            raise ValueError("PDF limit: 300 pages per file.")
        chunks, total = [], 0
        for page in reader.pages:
            text = page.extract_text() or ""
            total += len(text)
            if total > MAX_TEXT:
                raise ValueError("Extracted text exceeds 1 million characters.")
            chunks.append(text)
        return "\n".join(chunks)
    if suffix == ".docx":
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if sum(i.file_size for i in archive.infolist()) > 30 * 1024 * 1024:
                raise ValueError("DOCX expands beyond the 30 MB limit.")
        doc = Document(io.BytesIO(data))
        return "\n".join(
            [p.text for p in doc.paragraphs]
            + [c.text for t in doc.tables for r in t.rows for c in r.cells]
        )
    raise ValueError("Supported formats: PDF, DOCX, TXT, Markdown.")
