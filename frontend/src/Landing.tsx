import {
  Brain, Database, Zap, Package, AlertTriangle,
  ShoppingCart, ShieldCheck, ArrowRight, Play,
} from "lucide-react";

interface LandingProps {
  onLaunch: () => void;
}

const SYSTEM_METRICS = [
  { label: "Open Orders", value: "147", icon: ShoppingCart, color: "text-orange-400" },
  { label: "At Risk", value: "23", icon: AlertTriangle, color: "text-red-400" },
  { label: "Shortfall SKUs", value: "8", icon: Package, color: "text-yellow-400" },
  { label: "Trust-Protected", value: "1,204", icon: ShieldCheck, color: "text-green-400" },
];

export default function Landing({ onLaunch }: LandingProps) {
  return (
    <div className="flex h-screen flex-col bg-[#0a0a0a] text-neutral-200">
      {/* ── NAV BAR ── */}
      <nav className="flex items-center justify-between border-b border-neutral-800 bg-[#121212] px-8 py-4">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-orange-500" />
          <span className="text-lg font-bold tracking-tight text-white">
            Insight<span className="text-orange-500">Sphere</span>
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <a href="#" className="text-neutral-400 transition hover:text-white">
            Platform
          </a>
          <a href="#" className="text-neutral-400 transition hover:text-white">
            Docs
          </a>
          <a href="#" className="text-neutral-400 transition hover:text-white">
            Pricing
          </a>
          <button
            onClick={onLaunch}
            className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-orange-400"
          >
            Sign in
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div className="flex flex-1 items-center px-8 lg:px-16">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 lg:grid-cols-2">
          {/* Left: Copy */}
          <div className="flex flex-col justify-center">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded border border-orange-500/20 bg-orange-500/5 px-3 py-1.5 text-[11px] font-medium text-orange-400">
              <Zap className="h-3 w-3" />
              AUTONOMOUS INTELLIGENCE DECISION PLATFORM
            </div>
            <h1 className="mb-4 text-5xl font-bold leading-tight tracking-tight text-white">
              The intelligence
              <br />
              that <span className="text-orange-500">decides.</span>
            </h1>
            <p className="mb-8 max-w-lg text-base leading-relaxed text-neutral-400">
              Unify your inventory, orders, and workforce data into a single
              decision engine. Ask questions in natural language — get grounded
              answers with exact source citations from your records.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={onLaunch}
                className="flex items-center gap-2 rounded bg-orange-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-orange-400"
              >
                <Play className="h-4 w-4" />
                Launch control room
              </button>
              <button
                onClick={onLaunch}
                className="flex items-center gap-2 rounded border border-neutral-700 px-6 py-3 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white"
              >
                See the decision engine
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Right: System State Snapshot */}
          <div className="flex flex-col justify-center">
            <div className="rounded border border-neutral-800 bg-[#121212] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  System State — Live
                </h3>
                <span className="flex items-center gap-1.5 text-[11px] text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse-amber" />
                  All systems operational
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {SYSTEM_METRICS.map((m) => (
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
                    <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-4 border-t border-neutral-800 pt-4 text-[11px] text-neutral-600">
                <span className="flex items-center gap-1.5">
                  <Database className="h-3 w-3 text-orange-500" />
                  Chroma Cloud
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-orange-500" />
                  Groq + FastEmbed
                </span>
                <span className="flex items-center gap-1.5">
                  <Brain className="h-3 w-3 text-orange-500" />
                  RAG Pipeline
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="border-t border-neutral-800 bg-[#0e0e0e] px-8 py-4 text-center text-[11px] text-neutral-600">
        InsightSphere — The intelligence that decides · Powered by Groq, FastEmbed &amp; Chroma Cloud
      </footer>
    </div>
  );
}
