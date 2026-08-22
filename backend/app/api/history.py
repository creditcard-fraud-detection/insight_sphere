"""History endpoints — GET /files, GET /chats, GET /chats/{id}."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_user
from backend.app.db.database import ChatSession, FileRecord, Message, User, get_db

router = APIRouter()


# ── Response schemas ──────────────────────────────────────────────────


class FileOut(BaseModel):
    id: int
    filename: str
    upload_date: datetime | None = None


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    citations_json: str = "[]"
    sources_found: bool = False
    created_at: datetime | None = None


class ChatSessionOut(BaseModel):
    id: int
    title: str
    created_at: datetime | None = None
    message_count: int = 0


class ChatDetailOut(BaseModel):
    id: int
    title: str
    created_at: datetime | None = None
    messages: list[MessageOut] = []


# ── Endpoints ─────────────────────────────────────────────────────────


@router.get("/files", response_model=list[FileOut])
def list_files(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[FileRecord]:
    """Return all files uploaded by the current user, newest first."""
    records = (
        db.query(FileRecord)
        .filter(FileRecord.user_id == current_user.id)
        .order_by(FileRecord.id.desc())
        .all()
    )
    return records


@router.get("/chats", response_model=list[ChatSessionOut])
def list_chats(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[ChatSessionOut]:
    """Return all chat sessions for the current user, newest first."""
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.id.desc())
        .all()
    )
    result = []
    for s in sessions:
        msg_count = db.query(Message).filter(Message.session_id == s.id).count()
        result.append(ChatSessionOut(
            id=s.id,
            title=s.title,
            created_at=s.created_at,
            message_count=msg_count,
        ))
    return result


@router.get("/chats/{chat_id}", response_model=ChatDetailOut)
def get_chat(
    chat_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ChatDetailOut:
    """Return a specific chat session with all its messages."""
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == chat_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    messages = (
        db.query(Message)
        .filter(Message.session_id == session.id)
        .order_by(Message.id)
        .all()
    )

    return ChatDetailOut(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        messages=[
            MessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                citations_json=m.citations_json,
                sources_found=bool(m.sources_found),
                created_at=m.created_at,
            )
            for m in messages
        ],
    )


@router.post("/chats", response_model=ChatSessionOut, status_code=201)
def create_chat(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ChatSessionOut:
    """Create a new empty chat session."""
    session = ChatSession(user_id=current_user.id, title="New Chat")
    db.add(session)
    db.commit()
    db.refresh(session)
    return ChatSessionOut(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        message_count=0,
    )
