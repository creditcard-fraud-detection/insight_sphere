# InsightSphere Preview Run Doc

## How to reproduce artifacts

- `frontend/node_modules/` — run `cd frontend && npm install` from the project root
- Backend requires `venv/` — run `python -m venv venv && venv/Scripts/activate && pip install -r backend/requirements.txt`
- Backend `.env` with API keys must exist at `backend/.env` (GROQ_API_KEY, CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE)
- No local Ollama required — backend uses Groq cloud LLM + FastEmbed CPU embeddings + Chroma Cloud

## How to run the servers

1. Start the FastAPI backend (port 8000):
   ```
   venv/Scripts/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
   ```

2. Start the Vite frontend dev server (port 5173):
   ```
   cd frontend && npm run dev
   ```

Both servers must be running for the full experience. The frontend connects to the backend via CORS at `http://localhost:8000`.

## Windows detach recipe

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory 'D:\insightsphere\frontend' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
```

Confirm alive: `powershell -NoProfile -Command "Get-Process -Id <pid>"`
