"""InsightSphere — production-grade FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api import analytics, auth, chat, history, upload

app = FastAPI(
    title="InsightSphere API",
    description="Production RAG backend powered by Groq, FastEmbed, and ChromaDB.",
    version="2.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_origin_regex=r"https://insight-sphere.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(chat.router)
app.include_router(history.router)
app.include_router(analytics.router)


@app.get("/")
def root() -> dict:
    return {
        "app": "InsightSphere",
        "version": "2.0.0",
        "status": "online",
        "endpoints": ["/signup", "/login", "/me", "/upload", "/chat", "/files", "/chats", "/analytics/summary", "/docs"],
    }
