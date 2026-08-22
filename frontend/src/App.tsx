import { useState, useRef, useCallback, useEffect } from "react";
import {
  Brain, Database, Send, Upload, FileText, CheckCircle2,
  Loader2, Zap, MessageSquare, ChevronRight,
  Clock, CircleDot, LogOut, Plus, Trash2, FolderOpen,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
} from "lucide-react";
import Landing from "./Landing";
import Login from "./Login";

const API = "http://localhost:8000";

/* ── Types ─────────────────────────────────────────────────────────── */
interface Citation {
  file_name: string;
  row_number: number;
  content: string;
}
interface ChatApiResponse {
  answer: string;
  citations: Citation[];
  sources_found: boolean;
  chat_id: number;
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
interface FileRecord {
  id: number;
  filename: string;
  upload_date: string | null;
}
interface ChatSessionSummary {
  id: number;
  title: string;
  created_at: string | null;
  message_count: number;
}
interface ChatDetailMessage {
  id: number;
  role: string;
  content: string;
  citations_json: string;
  sources_found: boolean;
  created_at: string | null;
}
type View = "landing" | "login" | "dashboard";

/* ── Helpers ───────────────────────────────────────────────────────── */
const uid = () => crypto.randomUUID();

const QUICK_PROMPTS = [
  "Overdue payments summary",
  "Look up invoice records",
  "Which clients have outstanding balances?",
];

const INGESTION_STEPS = [
  "Ingesting",
  "Chunking",
  "Embedding",
  "Upserting to Chroma Cloud",
];

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

/* ── Component ─────────────────────────────────────────────────────── */
export default function App() {
  const [view, setView] = useState<View>("landing");

  // ── Sidebar state ──
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // ── Auth state ──
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [userName, setUserName] = useState<string | null>(() => {
    const u = localStorage.getItem("auth_user");
    return u ? JSON.parse(u).username : null;
  });

  useEffect(() => {
    if (authToken) setView("dashboard");
  }, []);

  const handleLogin = useCallback((token: string, username: string, _userId: number) => {
    setAuthToken(token);
    setUserName(username);
    setView("dashboard");
    // Explicitly fetch chats and files after login
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${API}/chats`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setChatSessions(data))
      .catch(() => {});
    fetch(`${API}/files`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setFiles(data))
      .catch(() => {});
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setAuthToken(null);
    setUserName(null);
    setChatSessions([]);
    setMessages([]);
    setCurrentChatId(null);
    setView("landing");
  }, []);

  const authHeaders = useCallback((): Record<string, string> => {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }, [authToken]);

  // ── Backend status ──
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [ingestedFiles, setIngestedFiles] = useState(0);

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

  // ── Sidebar: File list ──
  const [files, setFiles] = useState<FileRecord[]>([]);

  const fetchFiles = useCallback(async () => {
    if (!authToken) return;
    try {
      const r = await fetch(`${API}/files`, { headers: authHeaders() });
      if (r.ok) setFiles(await r.json());
    } catch { /* offline */ }
  }, [authToken, authHeaders]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // ── Sidebar: Chat history ──
  const [chatSessions, setChatSessions] = useState<ChatSessionSummary[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);

  const fetchChats = useCallback(async () => {
    if (!authToken) return;
    try {
      const r = await fetch(`${API}/chats`, { headers: authHeaders() });
      if (r.ok) setChatSessions(await r.json());
    } catch { /* offline */ }
  }, [authToken, authHeaders]);

  // Fetch chats whenever authToken changes (login, reload with stored token)
  useEffect(() => {
    if (authToken) {
      fetchChats();
    } else {
      setChatSessions([]);
    }
  }, [authToken, fetchChats]);

  const loadChat = useCallback(async (chatId: number) => {
    try {
      const r = await fetch(`${API}/chats/${chatId}`, { headers: authHeaders() });
      if (!r.ok) return;
      const detail: { id: number; title: string; messages: ChatDetailMessage[] } = await r.json();

      const loaded: ChatMessage[] = detail.messages.map((m) => {
        let citations: Citation[] = [];
        try { citations = JSON.parse(m.citations_json); } catch { /* empty */ }
        return {
          id: uid(),
          role: m.role as "user" | "assistant",
          content: m.content,
          citations,
          sourcesFound: m.sources_found,
          timestamp: m.created_at ? new Date(m.created_at) : new Date(),
        };
      });

      setMessages(loaded);
      setCurrentChatId(chatId);
    } catch { /* offline */ }
  }, [authHeaders]);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setCurrentChatId(null);
  }, []);

  // ── Upload state ──
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ingestionStep, setIngestionStep] = useState(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const supported = ["csv", "xlsx", "xls", "pdf", "docx"];
    if (!supported.includes(ext)) {
      setUploadError("Supported: .csv, .xlsx, .xls, .pdf, .docx");
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    setIngestionStep(0);

    const stepTimer = setInterval(() => {
      setIngestionStep((prev) => {
        if (prev >= INGESTION_STEPS.length - 1) {
          clearInterval(stepTimer);
          return prev;
        }
        return prev + 1;
      });
    }, 600);

    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`${API}/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Upload failed");
      setUploadResult({ filename: data.filename, rowsIngested: data.rows_ingested });
      setIngestedFiles((prev) => prev + 1);
      fetchFiles();
      window.dispatchEvent(new CustomEvent("ingestion-complete"));
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      clearInterval(stepTimer);
      setUploading(false);
      setTimeout(() => setIngestionStep(-1), 1500);
    }
  }, [authHeaders, fetchFiles]);

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
        id: uid(), role: "user", content: trimmed,
        citations: [], sourcesFound: false, timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const body: Record<string, unknown> = { message: trimmed, top_k: 4 };
        if (currentChatId) body.chat_id = currentChatId;

        const r = await fetch(`${API}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(body),
        });
        const data: ChatApiResponse = await r.json();
        if (!r.ok) throw new Error(data.answer || "Chat failed");

        if (data.chat_id) setCurrentChatId(data.chat_id);

        setMessages((prev) => [...prev, {
          id: uid(), role: "assistant", content: data.answer,
          citations: data.citations, sourcesFound: data.sources_found,
          timestamp: new Date(),
        }]);

        fetchChats();
      } catch (e: unknown) {
        setMessages((prev) => [...prev, {
          id: uid(), role: "assistant",
          content: `⚠️ ${e instanceof Error ? e.message : "Request failed"}`,
          citations: [], sourcesFound: false, timestamp: new Date(),
        }]);
      } finally {
        setLoading(false);
      }
    },
    [loading, authHeaders, currentChatId, fetchChats],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  VIEW ROUTING                                                      */
  /* ═══════════════════════════════════════════════════════════════════ */
  if (view === "landing") {
    return <Landing onLaunch={() => setView("login")} />;
  }

  if (view === "login") {
    return <Login onLogin={handleLogin} />;
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  DASHBOARD — 3-Pane Command Center                                 */
  /* ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-screen flex-col bg-[#0a0a0a] text-neutral-200">
      {/* ── HEADER ── */}
      <header className="border-b border-neutral-800 bg-[#121212]">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-blue-500" />
            <h1 className="text-lg font-bold tracking-tight text-white">
              InsightSphere
            </h1>
            <span className="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400 ring-1 ring-blue-500/30">
              AUTONOMOUS INTELLIGENCE
            </span>
          </div>

          <div className="flex items-center gap-3">
            {userName && (
              <span className="text-xs text-neutral-500">
                <span className="text-neutral-600">Signed in as </span>
                <span className="text-blue-400">{userName}</span>
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-red-500/30 hover:text-red-400"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* System status bar */}
        <div className="flex items-center gap-6 border-t border-neutral-800/50 bg-[#0e0e0e] px-6 py-1.5 text-[11px]">
          <span className="flex items-center gap-1.5 text-neutral-500">
            <Clock className="h-3 w-3" />
            System State — Right Now
          </span>
          <span className="h-3 w-px bg-neutral-800" />

          <span className="flex items-center gap-1.5">
            <CircleDot
              className={`h-2.5 w-2.5 ${
                backendUp ? "text-green-400" : backendUp === false ? "text-red-400" : "text-yellow-400 animate-pulse-amber"
              }`}
            />
            <span className="text-neutral-400">
              Backend: {backendUp ? "Online" : backendUp === false ? "Offline" : "…"}
            </span>
          </span>
          <span className="h-3 w-px bg-neutral-800" />

          <span className="flex items-center gap-1.5 text-neutral-400">
            <Database className="h-3 w-3 text-blue-500" />
            Chroma DB:
            <span className="text-green-400">Connected</span>
            <span className="text-neutral-600">(Insight_sphere)</span>
          </span>
          <span className="h-3 w-px bg-neutral-800" />

          <span className="flex items-center gap-1.5 text-neutral-400">
            <Zap className="h-3 w-3 text-blue-500" />
            Model:
            <span className="text-blue-400">Groq openai/gpt-oss-120b</span>
            <span className="text-neutral-600">/ FastEmbed BGE</span>
          </span>
          <span className="h-3 w-px bg-neutral-800" />

          <span className="flex items-center gap-1.5 text-neutral-400">
            <FileText className="h-3 w-3 text-blue-500" />
            Files Ingested:
            <span className="font-medium text-blue-400">{ingestedFiles}</span>
          </span>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/*  3-PANE LAYOUT: Left (Chat History) | Center (Chat) | Right (Upload) */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR: Chat History ── */}
        <aside
          className={`flex flex-col border-r border-neutral-800 bg-[#121212] overflow-y-auto transition-all duration-300 ${
            leftOpen ? "w-64" : "w-0 border-r-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              <MessageSquare className="h-3.5 w-3.5" />
              {leftOpen && "Chat History"}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={startNewChat}
                className="flex items-center gap-1 rounded border border-neutral-700 px-2 py-1 text-[10px] text-neutral-500 transition hover:border-blue-500/30 hover:text-blue-400"
                title="New chat"
              >
                <Plus className="h-3 w-3" />
                {leftOpen && "New"}
              </button>
              <button
                onClick={() => setLeftOpen(!leftOpen)}
                className="rounded p-1 text-neutral-600 transition hover:text-neutral-400"
                title={leftOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                {leftOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {leftOpen && (
            <div className="flex-1 overflow-y-auto p-3">
              {chatSessions.length === 0 ? (
                <p className="text-[11px] text-neutral-600 italic">
                  No conversations yet
                </p>
              ) : (
                <ul className="space-y-1">
                  {chatSessions.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => loadChat(s.id)}
                        className={`w-full rounded px-2 py-2 text-left text-xs transition ${
                          currentChatId === s.id
                            ? "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
                            : "text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {s.title}
                          </span>
                          <span className="ml-2 shrink-0 text-[10px] text-neutral-600">
                            {s.message_count} msgs
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-neutral-600">
                          {formatTime(s.created_at)}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}


            </div>
          )}
        </aside>

        {/* ── CENTER: Chat Interface ── */}
        <main className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Collapse toggle strip */}
          <div className="flex items-center gap-2 border-b border-neutral-800/50 bg-[#0e0e0e] px-4 py-1">
            <button
              onClick={() => setLeftOpen(!leftOpen)}
              className="rounded p-1 text-neutral-600 transition hover:text-blue-400"
              title={leftOpen ? "Collapse chat history" : "Show chat history"}
            >
              {leftOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
            </button>
            <span className="text-[10px] text-neutral-600">Chat</span>
            <div className="flex-1" />
            <button
              onClick={() => setRightOpen(!rightOpen)}
              className="rounded p-1 text-neutral-600 transition hover:text-blue-400"
              title={rightOpen ? "Collapse data panel" : "Show data panel"}
            >
              {rightOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 && !loading && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Brain className="mb-4 h-12 w-12 text-neutral-800" />
                <h2 className="text-lg font-medium text-neutral-300">
                  Ask your business data anything
                </h2>
                <p className="mt-1 max-w-md text-xs text-neutral-500">
                  Upload a document on the right, then ask questions here.
                  Answers are grounded strictly in your uploaded records.
                </p>
              </div>
            )}

            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-500/15 text-blue-100 ring-1 ring-blue-500/20"
                        : "bg-[#121212] text-neutral-200 ring-1 ring-neutral-800"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-500">
                        <MessageSquare className="h-3 w-3" />
                        InsightSphere
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {msg.citations.length > 0 && (
                      <div className="mt-3 border-t border-neutral-800 pt-2.5">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                          Source Citations
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((c, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded border border-neutral-800 bg-[#1a1a1a] px-2 py-1 text-[10px] text-neutral-400"
                            >
                              <FileText className="h-3 w-3 text-blue-500" />
                              {c.file_name}
                              <ChevronRight className="h-3 w-3 text-neutral-600" />
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
                  <div className="flex items-center gap-2 rounded bg-[#121212] px-4 py-3 text-xs text-neutral-500 ring-1 ring-neutral-800">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                    Thinking…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="border-t border-neutral-800 bg-[#121212] px-6 py-3">
            <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  className="rounded border border-neutral-800 bg-[#0a0a0a] px-3 py-1 text-[11px] text-neutral-500 transition hover:border-blue-500/30 hover:text-blue-400 disabled:opacity-50"
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
                className="flex-1 rounded border border-neutral-800 bg-[#0a0a0a] px-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none transition focus:border-blue-500/50 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim() || backendUp === false}
                className="flex items-center gap-1.5 rounded bg-blue-500 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-blue-400 disabled:opacity-50 disabled:hover:bg-blue-500"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </form>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR: Data Ingestion & Files ── */}
        <aside
          className={`flex flex-col border-l border-neutral-800 bg-[#121212] overflow-y-auto transition-all duration-300 ${
            rightOpen ? "w-80" : "w-0 border-l-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              <Upload className="h-3.5 w-3.5" />
              {rightOpen && "Data Ingestion"}
            </h2>
            <button
              onClick={() => setRightOpen(!rightOpen)}
              className="rounded p-1 text-neutral-600 transition hover:text-neutral-400"
              title={rightOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {rightOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            </button>
          </div>

          {rightOpen && (
            <>
              {/* Drop zone */}
              <div className="border-b border-neutral-800 p-4">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center gap-3 rounded border-2 border-dashed p-6 text-center transition-all ${
                    dragging
                      ? "border-blue-500 bg-blue-500/5"
                      : "border-neutral-700 hover:border-neutral-500 hover:bg-[#1a1a1a]"
                  }`}
                >
                  <Upload className="h-7 w-7 text-neutral-600" />
                  <p className="text-xs text-neutral-400">
                    Drop your files here or{" "}
                    <span className="text-blue-400 underline">browse</span>
                  </p>
                  <p className="text-[10px] text-neutral-600">
                    .csv · .xlsx · .pdf · .docx
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, .xlsx, .xls, .pdf, .docx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                      e.target.value = "";
                    }}
                  />
                </div>

                {uploading && (
                  <div className="mt-3 rounded border border-blue-500/20 bg-blue-500/5 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-blue-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Processing document…
                    </div>
                    <div className="flex flex-col gap-1">
                      {INGESTION_STEPS.map((step, i) => (
                        <div key={step} className="flex items-center gap-2 text-[11px]">
                          {i < ingestionStep ? (
                            <CheckCircle2 className="h-3 w-3 text-green-400" />
                          ) : i === ingestionStep ? (
                            <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                          ) : (
                            <div className="h-3 w-3 rounded-full border border-neutral-700" />
                          )}
                          <span
                            className={
                              i < ingestionStep
                                ? "text-green-400"
                                : i === ingestionStep
                                  ? "text-blue-400"
                                  : "text-neutral-600"
                            }
                          >
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="mt-3 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                    {uploadError}
                  </div>
                )}

                {uploadResult && !uploading && (
                  <div className="mt-3 rounded border border-green-500/20 bg-green-500/5 px-3 py-2.5 text-xs text-green-400">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {uploadResult.filename}
                    </div>
                    <div className="mt-1 text-green-500/70">
                      {uploadResult.rowsIngested} chunks ingested to Chroma Cloud
                    </div>
                  </div>
                )}
              </div>

              {/* Uploaded Files */}
              <div className="border-b border-neutral-800 p-4">
                <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Uploaded Files
                  <span className="ml-auto rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[10px] text-neutral-600">
                    {files.length}
                  </span>
                </h2>
                {files.length === 0 ? (
                  <p className="text-[11px] text-neutral-600 italic">
                    No files uploaded yet
                  </p>
                ) : (
                  <ul className="max-h-40 space-y-1 overflow-y-auto">
                    {files.map((f) => (
                      <li
                        key={f.id}
                        className="group flex items-center gap-2 rounded px-2 py-1.5 text-xs text-neutral-400 transition hover:bg-[#1a1a1a] hover:text-neutral-300"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500/70" />
                        <span className="min-w-0 flex-1 truncate">{f.filename}</span>
                        <span className="shrink-0 text-[10px] text-neutral-600">
                          {formatTime(f.upload_date)}
                        </span>
                        <Trash2 className="h-3 w-3 shrink-0 text-neutral-700 opacity-0 transition hover:text-red-400 group-hover:opacity-100" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

            </>
          )}
        </aside>
      </div>
    </div>
  );
}
