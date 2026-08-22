"""Generate grounded answers using Groq cloud LLM."""

from __future__ import annotations

import asyncio
import re
from functools import lru_cache

import groq

from backend.app.core.config import settings
from backend.app.services.retrieval import RetrievedChunk

SYSTEM_PROMPT = (
    "You are InsightSphere, a strict business intelligence assistant.\n"
    "Answer the user's question using ONLY the provided context snippets below.\n"
    "Rules:\n"
    "1. Ground every claim strictly in the context.\n"
    "2. Never assume or extrapolate numbers, dates, or prices not in the text.\n"
    '3. If the context does not contain enough information to answer, state clearly: '
    "'I cannot find this information in your uploaded records.'\n"
    "4. Always mention which file and row number provided the key figures."
)

# Preferred model order — first available wins
# Note: llama-3.3-70b-versatile was deprecated Aug 16, 2026.
# Recommended replacements per Groq deprecation page:
#   openai/gpt-oss-120b (for 70B), qwen/qwen3.6-27b, openai/gpt-oss-20b (for 8B)
MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"]


@lru_cache(maxsize=1)
def _get_client() -> groq.Groq:
    return groq.Groq(api_key=settings.GROQ_API_KEY)


def _build_context(chunks: list[RetrievedChunk]) -> str:
    parts = [
        f"[Source: {c.file_name}, Row: {c.row_number}] {c.document}"
        for c in chunks
    ]
    return "\n\n".join(parts)


def _sync_generate(chunks: list[RetrievedChunk], user_message: str) -> str:
    """Synchronous Groq call — invoked inside run_in_executor."""
    client = _get_client()
    context_block = _build_context(chunks)

    user_content = (
        f"Context:\n{context_block}\n\n"
        f"User question: {user_message}"
    )

    last_err: Exception | None = None
    for model in MODELS:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.1,
                max_tokens=1024,
            )
            raw = response.choices[0].message.content or ""
            # Strip <think>...</think> blocks from reasoning models
            cleaned = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
            return cleaned or raw
        except (groq.NotFoundError, groq.BadRequestError) as exc:
            last_err = exc
            continue

    raise RuntimeError(
        f"No Groq model available. Tried {MODELS}. Last error: {last_err}"
    )


async def generate_answer(
    chunks: list[RetrievedChunk],
    user_message: str,
) -> str:
    """Generate a grounded answer in a thread pool (non-blocking)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_generate, chunks, user_message)
