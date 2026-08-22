import { useState, useRef, useCallback, useEffect } from "react";
import {
  Brain,
  Database,
  Cpu,
  Send,
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  Zap,
  MessageSquare,
  ChevronRight,
  Server,
} from "lucide-react";

const API = "http://localhost:8000";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Citation {
  file_name: string;
  row_number: number;
  content: string;
}

interface ChatApiResponse {
  answer: string;
  citations: Citation[];
  sources_found: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  sourcesFound: boolean;
  timestamp: Date;
}

interface UploadResult {
  filename: string;
  rowsIngested: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const uid = () => crypto.randomUUID();

const QUICK_PROMPTS = [
  "Overdue payments summary",
  "Look up invoice records",
  "Which clients have outstanding balances?",
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function App() {
  // ── Backend status ──
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${API}/`);
        setBackendUp(r.ok);
      } catch {
        setBackendUp(false);
      }
    };
    check();
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, []);

  // ── Upload state ──
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Only .csv files are supported.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`${API}/upload`, { method: "POST", body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Upload failed");
      setUploadResult({
        filename: data.filename,
        rowsIngested: data.rows_ingested,
      });
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  // drag-and-drop
  const [dragging, setDragging] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  // ── Chat state ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: trimmed,
        citations: [],
        sourcesFound: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const r = await fetch(`${API}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, top_k: 4 }),
        });
        const data: ChatApiResponse = await r.json();
        if (!r.ok) throw new Error(data.answer || "Chat request failed");

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          sourcesFound: data.sources_found,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (e: unknown) {
        const errMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: `⚠️ ${e instanceof Error ? e.message : "Request failed"}`,
          citations: [],
          sourcesFound: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-200">
      {/* ────────── HEADER ────────── */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Brain className="h-7 w-7 text-indigo-400" />
          <h1 className="text-xl font-bold tracking-tight text-white">
            InsightSphere
          </h1>
          <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-medium text-indigo-300 ring-1 ring-indigo-500/30">
            Private &amp; Local BI
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${backendUp ? "bg-emerald-400" : backendUp === false ? "bg-red-400" : "bg-yellow-400 animate-pulse"}`}
          />
          <span className="text-slate-400">
            {backendUp ? "Backend online" : backendUp === false ? "Backend offline" : "Checking…"}
          </span>
        </div>
      </header>

      {/* ────────── MAIN GRID ────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT PANEL: Data Ingestion ── */}
        <aside className="flex w-80 flex-col gap-4 border-r border-slate-800 bg-slate-900/50 p-4 overflow-y-auto">
          {/* Upload area */}
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <Upload className="h-4 w-4" />
            Data Ingestion
          </h2>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-all ${
              dragging
                ? "border-indigo-400 bg-indigo-500/10"
                : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/50"
            }`}
          >
            <Upload className="h-8 w-8 text-slate-500" />
            <p className="text-sm text-slate-400">
              Drop a <span className="font-medium text-slate-200">.csv</span> file here or{" "}
              <span className="text-indigo-400 underline">browse</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
          </div>

          {uploading && (
            <div className="flex items-center gap-2 rounded-lg bg-indigo-500/10 px-3 py-2 text-sm text-indigo-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading &amp; embedding…
            </div>
          )}

          {uploadError && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {uploadError}
            </div>
          )}

          {uploadResult && (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{uploadResult.filename}</strong> ingested —{" "}
                {uploadResult.rowsIngested} row
                {uploadResult.rowsIngested !== 1 ? "s" : ""} added to ChromaDB.
              </span>
            </div>
          )}

          {/* System info card */}
          <div className="mt-auto rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Server className="h-3.5 w-3.5" />
              System Info
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-slate-300">
                <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                Local Ollama
                <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-400">
                  Qwen2.5-3B
                </span>
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Database className="h-3.5 w-3.5 text-indigo-400" />
                Vector Store
                <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-400">
                  ChromaDB
                </span>
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Zap className="h-3.5 w-3.5 text-indigo-400" />
                Embedding
                <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-400">
                  nomic-embed
                </span>
              </li>
            </ul>
          </div>
        </aside>

        {/* ── RIGHT PANEL: Chat ── */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Message feed */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 && !loading && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Brain className="mb-4 h-12 w-12 text-slate-700" />
                <h2 className="text-lg font-medium text-slate-300">
                  Ask your business data anything
                </h2>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  Upload a CSV on the left, then ask questions here. Answers are
                  grounded strictly in your uploaded records.
                </p>
              </div>
            )}

            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-slate-200 ring-1 ring-slate-700"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-indigo-400">
                        <MessageSquare className="h-3 w-3" />
                        InsightSphere
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Citations */}
                    {msg.citations.length > 0 && (
                      <div className="mt-3 border-t border-slate-700 pt-2.5">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Source Citations
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((c, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-700/50 px-2 py-1 text-[11px] text-slate-300 ring-1 ring-slate-600"
                            >
                              <FileText className="h-3 w-3 text-indigo-400" />
                              {c.file_name}
                              <ChevronRight className="h-3 w-3 text-slate-500" />
                              Row {c.row_number}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 text-sm text-slate-400 ring-1 ring-slate-700">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    Thinking…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* ── Input bar ── */}
          <div className="border-t border-slate-800 bg-slate-900/80 px-6 py-3 backdrop-blur">
            {/* Quick prompts */}
            <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  className="rounded-full bg-slate-800 px-3 py-1 text-[11px] text-slate-400 ring-1 ring-slate-700 transition hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your business data…"
                disabled={loading || backendUp === false}
                className="flex-1 rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 ring-1 ring-slate-700 outline-none transition focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim() || backendUp === false}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
