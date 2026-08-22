"""Query ChromaDB for similar chunks given a query embedding."""

from __future__ import annotations

from dataclasses import dataclass

from backend.app.db.chroma_client import get_collection


@dataclass
class RetrievedChunk:
    document: str
    file_name: str
    row_number: int
    distance: float


def query_similar(query_vec: list[float], top_k: int = 4) -> list[RetrievedChunk]:
    """Return the top-k most similar chunks from ChromaDB.

    Returns an empty list when the collection has no documents.
    """
    collection = get_collection()

    if collection.count() == 0:
        return []

    results = collection.query(
        query_embeddings=[query_vec],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    docs = results["documents"][0] if results.get("documents") else []
    metas = results["metadatas"][0] if results.get("metadatas") else []
    dists = results["distances"][0] if results.get("distances") else []

    return [
        RetrievedChunk(
            document=doc,
            file_name=meta.get("file_name", "unknown"),
            row_number=meta.get("row_number", -1),
            distance=dist,
        )
        for doc, meta, dist in zip(docs, metas, dists)
    ]
