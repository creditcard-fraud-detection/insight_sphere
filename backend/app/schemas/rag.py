"""Pydantic schemas for the RAG pipeline."""

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    top_k: int = 4


class Citation(BaseModel):
    file_name: str
    row_number: int
    content: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    sources_found: bool
