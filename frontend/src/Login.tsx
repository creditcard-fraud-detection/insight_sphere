import { useState } from "react";
import { Brain, Mail, Lock, User, ArrowRight, Loader2, AlertCircle } from "lucide-react";

interface LoginProps {
  onLogin: (token: string, username: string, userId: number) => void;
}

type AuthMode = "signin" | "signup";

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API = "http://localhost:8000";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = mode === "signup" ? "/signup" : "/login";
      const body =
        mode === "signup"
          ? { username, email, password }
          : { email, password };

      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");

      localStorage.setItem("auth_token", data.access_token);
      localStorage.setItem("auth_user", JSON.stringify({
        user_id: data.user_id,
        username: data.username,
      }));

      onLogin(data.access_token, data.username, data.user_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-neutral-200">
      {/* Background grid pattern */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#525252 1px, transparent 1px), linear-gradient(90deg, #525252 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded border border-blue-500/30 bg-blue-500/10">
            <Brain className="h-7 w-7 text-blue-500" />
          </div>
          <h1 className="text-xl font-bold text-white">InsightSphere</h1>
          <span className="mt-1 rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400 ring-1 ring-blue-500/30">
            AUTONOMOUS INTELLIGENCE
          </span>
        </div>

        {/* Login card */}
        <div className="rounded border border-neutral-800 bg-[#121212] p-6">
          <h2 className="mb-1 text-center text-lg font-semibold text-white">
            {mode === "signin"
              ? "Sign in to the control deck"
              : "Create your account"}
          </h2>
          <p className="mb-5 text-center text-sm text-neutral-500">
            {mode === "signin"
              ? "Enter your email and password to sign in."
              : "Set up your InsightSphere workspace."}
          </p>

          {/* Mode toggle */}
          <div className="mb-5 flex rounded border border-neutral-800 bg-[#0a0a0a] p-0.5">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(null); }}
              className={`flex-1 rounded py-2 text-xs font-medium transition ${
                mode === "signin"
                  ? "bg-blue-500/15 text-blue-400"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(null); }}
              className={`flex-1 rounded py-2 text-xs font-medium transition ${
                mode === "signup"
                  ? "bg-blue-500/15 text-blue-400"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Username — signup only */}
            {mode === "signup" && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full rounded border border-neutral-800 bg-[#0a0a0a] py-3 pl-10 pr-4 text-sm text-neutral-200 placeholder-neutral-600 outline-none transition focus:border-blue-500/50"
                  autoFocus
                  required
                />
              </div>
            )}

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded border border-neutral-800 bg-[#0a0a0a] py-3 pl-10 pr-4 text-sm text-neutral-200 placeholder-neutral-600 outline-none transition focus:border-blue-500/50"
                autoFocus={mode === "signin"}
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded border border-neutral-800 bg-[#0a0a0a] py-3 pl-10 pr-4 text-sm text-neutral-200 placeholder-neutral-600 outline-none transition focus:border-blue-500/50"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="flex w-full items-center justify-center gap-2 rounded bg-blue-500 py-3 text-sm font-semibold text-black transition hover:bg-blue-400 disabled:opacity-50 disabled:hover:bg-blue-500"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === "signin" ? "Sign In" : "Create Account"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-neutral-600">
          InsightSphere autonomous intelligence decision platform
        </p>
      </div>
    </div>
  );
}
