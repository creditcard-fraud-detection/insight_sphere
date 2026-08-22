"""POST /chat — RAG retrieval + grounded generation with persistent history."""

from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_user
from backend.app.db.database import ChatSession, Message, User, get_db
from backend.app.schemas.rag import (
    ChatRequest,
    Citation,
)
from backend.app.services.embedding import embed_query
from backend.app.services.llm import generate_answer
from backend.app.services.retrieval import query_similar

router = APIRouter()


class ChatResponseWithId(BaseModel):
    answer: str
    citations: list[Citation]
    sources_found: bool
    chat_id: int


@router.post("/chat", response_model=ChatResponseWithId)
async def chat(
    request: ChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ChatResponseWithId:
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message must not be empty.")

    # ── 0. Resolve or create chat session ──
    if request.chat_id:
        session = (
            db.query(ChatSession)
            .filter(ChatSession.id == request.chat_id, ChatSession.user_id == current_user.id)
            .first()
        )
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found.")
    else:
        # Create new session — auto-title from first user message
        title = request.message[:60].strip()
        if len(request.message) > 60:
            title += "…"
        session = ChatSession(user_id=current_user.id, title=title)
        db.add(session)
        db.commit()
        db.refresh(session)

    # ── 1. Save user message ──
    user_msg = Message(
        session_id=session.id,
        role="user",
        content=request.message,
        citations_json="[]",
        sources_found=0,
    )
    db.add(user_msg)
    db.commit()

    # ── 2. Embed the user query ──
    try:
        query_vec = await embed_query(request.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {exc}")

    # ── 3. Retrieve similar chunks ──
    chunks = query_similar(query_vec, top_k=request.top_k)

    if not chunks:
        answer = "No uploaded business records found to answer this question."
        citations_list: list[Citation] = []
        sources_found = False
    else:
        citations_list = [
            Citation(file_name=c.file_name, row_number=c.row_number, content=c.document)
            for c in chunks
        ]
        sources_found = True

        # ── 4. Generate grounded answer ──
        try:
            answer = await generate_answer(chunks, request.message)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"LLM generation failed: {exc}")

    # ── 5. Save assistant message ──
    assistant_msg = Message(
        session_id=session.id,
        role="assistant",
        content=answer,
        citations_json=json.dumps([c.model_dump() for c in citations_list]),
        sources_found=1 if sources_found else 0,
    )
    db.add(assistant_msg)
    db.commit()

    return ChatResponseWithId(
        answer=answer,
        citations=citations_list,
        sources_found=sources_found,
        chat_id=session.id,
    )
