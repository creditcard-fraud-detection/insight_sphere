# InsightSphere Preview Run Doc

## How to reproduce artifacts

- `frontend/node_modules/` — run `cd frontend && npm install` from the project root
- Backend requires `venv/` — run `python -m venv venv && venv/Scripts/activate && pip install -r requirements.txt`
- Ollama models must be pulled: `ollama pull qwen2.5:3b` and `ollama pull nomic-embed-text`

## How to run the servers

1. Start the FastAPI backend (port 8000):
   ```
   venv/Scripts/python -m uvicorn main:app --host 127.0.0.1 --port 8000
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
