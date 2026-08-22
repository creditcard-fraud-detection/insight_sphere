"""POST /chat — RAG retrieval + grounded generation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.app.schemas.rag import (
    ChatRequest,
    ChatResponse,
    Citation,
)
from backend.app.services.embedding import embed_query
from backend.app.services.llm import generate_answer
from backend.app.services.retrieval import query_similar

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message must not be empty.")

    # ── 1. Embed the user query ──
    try:
        query_vec = await embed_query(request.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {exc}")

    # ── 2. Retrieve similar chunks ──
    chunks = query_similar(query_vec, top_k=request.top_k)

    if not chunks:
        return ChatResponse(
            answer="No uploaded business records found to answer this question.",
            citations=[],
            sources_found=False,
        )

    # ── 3. Build citations from retrieved chunks ──
    citations = [
        Citation(
            file_name=c.file_name,
            row_number=c.row_number,
            content=c.document,
        )
        for c in chunks
    ]

    # ── 4. Generate grounded answer ──
    try:
        answer = await generate_answer(chunks, request.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"LLM generation failed: {exc}")

    return ChatResponse(
        answer=answer,
        citations=citations,
        sources_found=True,
    )
