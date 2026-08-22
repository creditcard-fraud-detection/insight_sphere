"""POST /upload — ingest a CSV file into ChromaDB."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.app.db.chroma_client import get_collection
from backend.app.services.chunking import rows_to_chunks
from backend.app.services.embedding import embed_texts
from backend.app.services.ingestion import parse_csv

router = APIRouter()


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)) -> dict:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    # ── 1. Parse CSV ──
    try:
        contents = await file.read()
        df = parse_csv(contents, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {exc}")

    # ── 2. Chunk rows ──
    chunks = rows_to_chunks(df)

    # ── 3. Embed all chunks ──
    try:
        embeddings = await embed_texts([c.text for c in chunks])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {exc}")

    # ── 4. Upsert into ChromaDB ──
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

    return {
        "status": "success",
        "filename": file.filename,
        "rows_ingested": len(chunks),
    }
