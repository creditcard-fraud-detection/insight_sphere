"""Application settings loaded from environment / .env file."""

from pathlib import Path
import os

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # backend/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "insightsphere-dev-secret-change-in-production")

    # ── Groq ──
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # ── Chroma Cloud ──
    CHROMA_DB_URL: str = os.getenv("CHROMA_DB_URL", "")
    CHROMA_API_KEY: str | None = os.getenv("CHROMA_API_KEY")
    CHROMA_TENANT: str = os.getenv("CHROMA_TENANT", "")
    CHROMA_DATABASE: str = os.getenv("CHROMA_DATABASE", "Insight_sphere")
    CHROMA_COLLECTION: str = os.getenv("CHROMA_COLLECTION", "business_records")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "insightsphere-dev-secret-change-in-production")

settings = Settings()
