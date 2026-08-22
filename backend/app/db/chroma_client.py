"""ChromaDB client — connects via Chroma Cloud when API key is set, otherwise local."""

import chromadb

from backend.app.core.config import settings


def _build_client() -> chromadb.ClientAPI:
    if settings.CHROMA_API_KEY:
        return chromadb.CloudClient(
            api_key=settings.CHROMA_API_KEY,
            tenant=settings.CHROMA_TENANT,
            database=settings.CHROMA_DATABASE,
        )
    return chromadb.PersistentClient(path="./chroma_db")


client = _build_client()


def get_collection() -> chromadb.Collection:
    """Return the shared collection with embedding_function=None (we embed ourselves)."""
    return client.get_or_create_collection(
        name=settings.CHROMA_COLLECTION,
        embedding_function=None,
    )
