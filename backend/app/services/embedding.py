"""Generate embeddings using fastembed (CPU-native, zero-cost)."""

from __future__ import annotations

import asyncio
from functools import lru_cache

from fastembed import TextEmbedding

MODEL_NAME = "BAAI/bge-small-en-v1.5"


@lru_cache(maxsize=1)
def _get_model() -> TextEmbedding:
    """Lazy-init the embedding model (downloads on first call, then cached)."""
    return TextEmbedding(model_name=MODEL_NAME)


def _sync_embed(texts: list[str]) -> list[list[float]]:
    """Synchronous embedding — called inside run_in_executor."""
    model = _get_model()
    return [vec.tolist() for vec in model.embed(texts)]


def _sync_embed_single(text: str) -> list[float]:
    """Embed a single text string."""
    return _sync_embed([text])[0]


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts in a thread pool (non-blocking)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_embed, texts)


async def embed_query(text: str) -> list[float]:
    """Embed a single query string in a thread pool (non-blocking)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_embed_single, text)
