import {
  Brain, Database, Zap, Upload, Scissors, Binary, CloudUpload,
  CheckCircle2, ArrowRight, Play, FileSearch, MessageSquare,
  Sparkles, Shield, BarChart3, FileText, Brackets,
} from "lucide-react";

interface LandingProps {
  onLaunch: () => void;
}

/* ── System Architecture Stats ── */
const ARCH_STATS = [
  { label: "VECTOR ENGINE", value: "Chroma Cloud", icon: Database, color: "text-blue-400" },
  { label: "EMBEDDING MODEL", value: "FastEmbed BGE", icon: Binary, color: "text-blue-400" },
  { label: "INFERENCE", value: "Groq Llama 3", icon: Zap, color: "text-green-400" },
  { label: "DATA PARSER", value: "CSV / Excel / PDF", icon: FileText, color: "text-purple-400" },
];

/* ── Ingestion Loop Steps ── */
const INGESTION_STEPS = [
  { num: "01", label: "UPLOAD", desc: "Drag & drop any file", icon: Upload },
  { num: "02", label: "CHUNKING", desc: "Structured row parsing", icon: Scissors },
  { num: "03", label: "TOKENIZATION", desc: "Sub-word text encoding", icon: Brackets },
  { num: "04", label: "EMBEDDING", desc: "Vector representation", icon: Binary },
  { num: "05", label: "UPSERTING", desc: "Cloud vector storage", icon: CloudUpload },
  { num: "06", label: "READY", desc: "Queryable in milliseconds", icon: CheckCircle2 },
];

/* ── Decision Engine Steps ── */
const DECISION_STEPS = [
  {
    num: "01",
    label: "QUERY",
    desc: "Ask any question in natural language. InsightSphere parses intent and identifies which data fields to search.",
    icon: MessageSquare,
  },
  {
    num: "02",
    label: "RETRIEVAL",
    desc: "The embedding engine finds the exact source rows that match your question — ranked by semantic similarity.",
    icon: FileSearch,
  },
  {
    num: "03",
    label: "GROUNDED ANSWER",
    desc: "The LLM synthesizes a response grounded strictly in the retrieved context. Every claim cites its source row.",
    icon: Sparkles,
  },
];

/* ── Capabilities ── */
const CAPABILITIES = [
  {
    title: "Universal Data Visualizer",
    desc: "Auto-detects metrics, categories, and trends from any tabular data — no configuration needed.",
    icon: BarChart3,
  },
  {
    title: "Exact Row Citations",
    desc: "Every answer points back to the source file and row number. Zero hallucinated data.",
    icon: FileSearch,
  },
  {
    title: "Lightning Fast Inference",
    desc: "Powered by Groq LPUs for sub-second responses even on complex analytical queries.",
    icon: Zap,
  },
  {
    title: "Secure Local Context",
    desc: "Your business data never trains public models. All embeddings stay in your private Chroma Cloud.",
    icon: Shield,
  },
];

export default function Landing({ onLaunch }: LandingProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-neutral-200">

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  NAV BAR                                                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-neutral-800 bg-[#121212]/95 px-8 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-blue-500" />
          <span className="text-lg font-bold tracking-tight text-white">
            Insight<span className="text-blue-500">Sphere</span>
          </span>
        </div>
        <button
          onClick={onLaunch}
          className="flex items-center gap-2 rounded bg-blue-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-blue-400"
        >
          Sign in to control deck
          <ArrowRight className="h-4 w-4" />
        </button>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  HERO                                                          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="flex items-center px-8 py-20 lg:px-16">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 lg:grid-cols-2">
          {/* Left: Copy */}
          <div className="flex flex-col justify-center">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded border border-blue-500/20 bg-blue-500/5 px-3 py-1.5 text-[11px] font-medium text-blue-400">
              <Zap className="h-3 w-3" />
              AUTONOMOUS INTELLIGENCE DECISION PLATFORM
            </div>
            <h1 className="mb-4 text-5xl font-bold leading-tight tracking-tight text-white">
              The intelligence
              <br />
              that <span className="text-blue-500">decides.</span>
            </h1>
            <p className="mb-8 max-w-lg text-base leading-relaxed text-neutral-400">
              Upload your business data. Ask questions in natural language.
              Get grounded answers with exact source citations — zero hallucinations.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={onLaunch}
                className="flex items-center gap-2 rounded bg-blue-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-blue-400"
              >
                <Play className="h-4 w-4" />
                Launch control deck
              </button>
            </div>
          </div>

          {/* Right: System Architecture Stats */}
          <div className="flex flex-col justify-center">
            <div className="rounded border border-neutral-800 bg-[#121212] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  System Architecture
                </h3>
                <span className="flex items-center gap-1.5 text-[11px] text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  All systems operational
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {ARCH_STATS.map((m) => (
                  <div
                    key={m.label}
                    className="rounded border border-neutral-800 bg-[#0a0a0a] p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-600">
                        {m.label}
                      </span>
                      <m.icon className={`h-4 w-4 ${m.color}`} />
                    </div>
                    <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  SECTION 1: THE INGESTION LOOP                                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="border-t border-neutral-800 bg-[#0e0e0e] px-8 py-20 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-500">
              The Ingestion Loop
            </h2>
            <p className="text-3xl font-bold text-white">
              From file to <span className="text-blue-500">queryable</span> in five steps
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-0 right-0 top-6 h-px bg-neutral-800" />

            <div className="grid grid-cols-6 gap-4">
              {INGESTION_STEPS.map((step) => (
                <div key={step.num} className="relative flex flex-col items-center text-center">
                  {/* Step circle */}
                  <div className="relative z-10 mb-4 flex h-12 w-12 items-center justify-center rounded border border-blue-500/30 bg-[#121212]">
                    <step.icon className="h-5 w-5 text-blue-500" />
                  </div>
                  {/* Step number */}
                  <span className="mb-1 text-[10px] font-bold tracking-widest text-blue-500">
                    {step.num}
                  </span>
                  {/* Step label */}
                  <span className="mb-1 text-sm font-semibold text-white">
                    {step.label}
                  </span>
                  {/* Step description */}
                  <span className="text-[11px] text-neutral-500">
                    {step.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  SECTION 2: THE DECISION ENGINE                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="border-t border-neutral-800 px-8 py-20 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-500">
              The Decision Engine
            </h2>
            <p className="text-3xl font-bold text-white">
              Query → Retrieval → <span className="text-blue-500">Grounded Answer</span>
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-500">
              The AI finds exact source rows before answering, ensuring zero hallucinations
              and complete traceability back to your original data.
            </p>
          </div>

          {/* 3-Part Flow */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {DECISION_STEPS.map((step) => (
              <div
                key={step.num}
                className="rounded border border-neutral-800 bg-[#121212] p-6 transition hover:border-blue-500/30"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-blue-500/20 bg-blue-500/5">
                    <step.icon className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold tracking-widest text-blue-500">
                      STEP {step.num}
                    </span>
                    <h3 className="text-lg font-bold text-white">{step.label}</h3>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-neutral-400">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  SECTION 3: CAPABILITIES                                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="border-t border-neutral-800 bg-[#0e0e0e] px-8 py-20 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-500">
              Capabilities
            </h2>
            <p className="text-3xl font-bold text-white">
              Built for <span className="text-blue-500">serious</span> data work
            </p>
          </div>

          {/* 2x2 Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {CAPABILITIES.map((cap) => (
              <div
                key={cap.title}
                className="rounded border border-neutral-800 bg-[#121212] p-6 transition hover:border-blue-500/30"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-blue-500/20 bg-blue-500/5">
                    <cap.icon className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="text-base font-bold text-white">{cap.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-neutral-400">
                  {cap.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  CTA + FOOTER                                                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="border-t border-neutral-800 px-8 py-20 text-center lg:px-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-3xl font-bold text-white">
            Ready to <span className="text-blue-500">decide</span>?
          </h2>
          <p className="mb-8 text-sm text-neutral-500">
            Upload your first document and ask a question in under 60 seconds.
          </p>
          <button
            onClick={onLaunch}
            className="flex mx-auto items-center gap-2 rounded bg-blue-500 px-8 py-3 text-sm font-semibold text-black transition hover:bg-blue-400"
          >
            <Play className="h-4 w-4" />
            Launch control deck
          </button>
        </div>
      </section>

      <footer className="border-t border-neutral-800 bg-[#121212] px-8 py-4 text-center text-[11px] text-neutral-600">
        InsightSphere — The intelligence that decides · Powered by Groq, FastEmbed &amp; Chroma Cloud
      </footer>
    </div>
  );
}
