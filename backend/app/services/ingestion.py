"""Parse uploaded documents (CSV, Excel, PDF, DOCX) into text chunks."""

from __future__ import annotations

import io
import os
from dataclasses import dataclass

import pandas as pd


@dataclass
class Chunk:
    text: str
    file_name: str
    row_number: int


# ── Supported extensions ───────────────────────────────────────────────
_CSV_EXTENSIONS = {".csv"}
_EXCEL_EXTENSIONS = {".xlsx", ".xls"}
_PDF_EXTENSIONS = {".pdf"}
_DOCX_EXTENSIONS = {".docx"}
SUPPORTED_EXTENSIONS = _CSV_EXTENSIONS | _EXCEL_EXTENSIONS | _PDF_EXTENSIONS | _DOCX_EXTENSIONS


def _ext(filename: str) -> str:
    """Return lowercase file extension (with dot)."""
    return os.path.splitext(filename)[1].lower()


# ── CSV / Excel ────────────────────────────────────────────────────────

def _parse_spreadsheet(file_bytes: bytes, filename: str) -> list[Chunk]:
    """Parse CSV or Excel into row-level text chunks."""
    ext = _ext(filename)

    if ext in _CSV_EXTENSIONS:
        df = pd.read_csv(io.BytesIO(file_bytes))
    elif ext in _EXCEL_EXTENSIONS:
        df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
    else:
        raise ValueError(f"Unsupported spreadsheet extension: {ext}")

    if df.empty:
        raise ValueError(f"The uploaded file '{filename}' contains no data.")

    chunks: list[Chunk] = []
    for idx, row in df.iterrows():
        parts = [
            f"{col} is {val}"
            for col, val in row.items()
            if pd.notna(val)
        ]
        text = "Row data: " + ", ".join(parts)
        chunks.append(Chunk(text=text, file_name=filename, row_number=int(idx)))

    return chunks


# ── PDF ────────────────────────────────────────────────────────────────

def _parse_pdf(file_bytes: bytes, filename: str) -> list[Chunk]:
    """Parse PDF page-by-page into text chunks."""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(file_bytes))
    pages = reader.pages

    if not pages:
        raise ValueError(f"The uploaded PDF '{filename}' has no pages.")

    chunks: list[Chunk] = []
    for page_num, page in enumerate(pages):
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            chunks.append(
                Chunk(
                    text=f"Page {page_num + 1}: {text}",
                    file_name=filename,
                    row_number=page_num,
                )
            )

    if not chunks:
        raise ValueError(f"The uploaded PDF '{filename}' contains no extractable text.")

    return chunks


# ── Word (DOCX) ────────────────────────────────────────────────────────

def _parse_docx(file_bytes: bytes, filename: str) -> list[Chunk]:
    """Parse DOCX paragraph-by-paragraph into text chunks."""
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))
    paragraphs = doc.paragraphs

    if not paragraphs:
        raise ValueError(f"The uploaded DOCX '{filename}' has no content.")

    chunks: list[Chunk] = []
    for para_num, para in enumerate(paragraphs):
        text = para.text.strip()
        if text:
            chunks.append(
                Chunk(
                    text=text,
                    file_name=filename,
                    row_number=para_num,
                )
            )

    if not chunks:
        raise ValueError(f"The uploaded DOCX '{filename}' contains no extractable text.")

    return chunks


# ── Unified entry point ────────────────────────────────────────────────

def parse_document(file_bytes: bytes, filename: str) -> list[Chunk]:
    """Parse any supported document and return a list of text chunks.

    Supported formats:
        - CSV (.csv)
        - Excel (.xlsx, .xls)
        - PDF (.pdf)
        - Word (.docx)

    Raises:
        ValueError: If the file is empty, unsupported, or unparseable.
    """
    ext = _ext(filename)

    if not ext or ext not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise ValueError(
            f"Unsupported file type '{ext}'. Supported formats: {supported}"
        )

    if ext in _CSV_EXTENSIONS | _EXCEL_EXTENSIONS:
        return _parse_spreadsheet(file_bytes, filename)
    elif ext in _PDF_EXTENSIONS:
        return _parse_pdf(file_bytes, filename)
    elif ext in _DOCX_EXTENSIONS:
        return _parse_docx(file_bytes, filename)
    else:
        raise ValueError(f"Unsupported file type: {ext}")
