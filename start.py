"""
InsightSphere — launch both backend (FastAPI) and frontend (Vite) together.

Usage:
    python start.py          # starts both servers
    python start.py --help   # show options

Press Ctrl+C to stop both servers.
"""

import subprocess
import sys
import signal
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"

# Ensure we use the venv Python even if start.py was run outside the venv
VENV_PYTHON = ROOT / "venv" / "Scripts" / "python.exe"
if VENV_PYTHON.exists() and sys.prefix == sys.base_prefix:
    # We're not inside a venv — use the venv python explicitly
    PYTHON = str(VENV_PYTHON)
else:
    PYTHON = sys.executable


def main() -> None:
    # ── Backend ──
    backend_cmd = [
        PYTHON,
        "-m",
        "uvicorn",
        "backend.app.main:app",
        "--reload",
        "--port",
        "8000",
    ]

    # ── Frontend ──
    frontend_cmd = ["npm", "run", "dev"]

    procs: list[subprocess.Popen] = []

    def cleanup(*_args: object) -> None:
        """Terminate both child processes on Ctrl+C."""
        for p in procs:
            if p.poll() is None:
                p.terminate()
        for p in procs:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print("=" * 60)
    print("  InsightSphere — Starting servers")
    print("=" * 60)
    print()

    # Start backend
    print(f"[backend]  {' '.join(backend_cmd)}")
    backend = subprocess.Popen(
        backend_cmd,
        cwd=str(ROOT),
        # No Windows-specific CREATE_NO_WINDOW so output streams to console
    )
    procs.append(backend)

    # Start frontend
    print(f"[frontend] {' '.join(frontend_cmd)}  (cwd={FRONTEND})")
    frontend = subprocess.Popen(
        frontend_cmd,
        cwd=str(FRONTEND),
        shell=(sys.platform == "win32"),  # needed so npm.cmd resolves on Windows
    )
    procs.append(frontend)

    print()
    print("  Backend  → http://localhost:8000")
    print("  Frontend → http://localhost:5173")
    print()
    print("  Press Ctrl+C to stop both servers.")
    print("=" * 60)
    print()

    # Block until either process exits unexpectedly
    try:
        while True:
            for p in procs:
                code = p.poll()
                if code is not None:
                    print(f"\n⚠️  Process exited with code {code}")
                    cleanup()
            # Small sleep to avoid busy-wait
            import time
            time.sleep(0.5)
    except KeyboardInterrupt:
        cleanup()


if __name__ == "__main__":
    main()
