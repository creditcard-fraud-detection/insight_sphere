"""POST /upload — ingest a document (CSV, Excel, PDF, DOCX) into ChromaDB."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_user
from backend.app.db.database import FileRecord, User, get_db
from backend.app.db.chroma_client import get_collection
from backend.app.services.embedding import embed_texts
from backend.app.services.ingestion import SUPPORTED_EXTENSIONS, parse_document

router = APIRouter()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
) -> dict:
    """Ingest an uploaded document into ChromaDB.

    Supports: CSV, Excel (.xlsx/.xls), PDF, and Word (.docx).
    """
    # ── 0. Validate file type ──
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if f".{ext}" not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{ext}'. Supported: {supported}",
        )

    # ── 1. Parse document → chunks ──
    try:
        contents = await file.read()
        chunks = parse_document(contents, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse document: {exc}")

    if not chunks:
        raise HTTPException(status_code=400, detail="No content found in the document.")

    # ── 2. Embed all chunks ──
    try:
        embeddings = await embed_texts([c.text for c in chunks])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {exc}")

    # ── 3. Upsert into ChromaDB ──
    try:
        collection = get_collection()
        collection.add(
            documents=[c.text for c in chunks],
            embeddings=embeddings,
            metadatas=[
                {"file_name": c.file_name, "row_number": c.row_number}
                for c in chunks
            ],
            ids=[
                f"{c.file_name}_row_{c.row_number}_{uuid.uuid4().hex[:6]}"
                for c in chunks
            ],
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ChromaDB upsert failed: {exc}")

    # ── 4. Record in user's file history ──
    record = FileRecord(user_id=current_user.id, filename=file.filename)
    db.add(record)
    db.commit()

    return {
        "status": "success",
        "filename": file.filename,
        "rows_ingested": len(chunks),
    }
