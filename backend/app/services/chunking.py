"""Text chunking utilities for the RAG pipeline.

The Chunk dataclass and parse_document() are now defined in ingestion.py.
This module re-exports them for backward compatibility.
"""

from backend.app.services.ingestion import Chunk, parse_document  # noqa: F401

__all__ = ["Chunk", "parse_document"]
