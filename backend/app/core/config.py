"""Application settings loaded from environment / .env file."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # backend/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Auth ──
    JWT_SECRET_KEY: str = "insightsphere-dev-secret-change-in-production"

    # ── Groq ──
    GROQ_API_KEY: str = ""

    # ── Chroma Cloud ──
    CHROMA_API_KEY: str | None = None
    CHROMA_TENANT: str = ""
    CHROMA_DATABASE: str = "Insight_sphere"
    CHROMA_COLLECTION: str = "business_records"


settings = Settings()
