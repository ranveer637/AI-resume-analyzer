// src/Login.jsx
import React, { useState } from "react";

export default function Login() {
  const [role, setRole] = useState("candidate"); // 'candidate' or 'recruiter'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || "";
  const apiUrl = (p) => `${API_BASE}${p.startsWith("/") ? p : "/" + p}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!email || !password) {
      setMessage({ type: "error", text: "Please fill in all fields." });
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Login failed." });
      } else {
        setMessage({ type: "success", text: data.message || "Login successful!" });
        // TODO: save token in localStorage and redirect to dashboard
        // localStorage.setItem("token", data.token);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#4f46e5_0,_transparent_55%),radial-gradient(circle_at_bottom,_#0ea5e9_0,_transparent_55%)] opacity-30" />
      </div>

      <div className="w-full max-w-md bg-slate-900/80 border border-white/10 rounded-2xl shadow-2xl shadow-indigo-500/20 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-xl bg-indigo-500 flex items-center justify-center text-sm font-bold">
            AI
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Login to AI Resume Analyzer
            </h1>
            <p className="text-xs text-slate-400">
              Sign in as a job seeker or hiring manager.
            </p>
          </div>
        </div>

        {/* Role toggle */}
        <div className="flex mb-4 text-[11px] bg-slate-800 rounded-full p-1 border border-white/5">
          <button
            type="button"
            onClick={() => setRole("candidate")}
            className={`flex-1 px-3 py-1 rounded-full transition ${
              role === "candidate"
                ? "bg-indigo-500 text-white shadow-sm"
                : "text-slate-300"
            }`}
          >
            Job Seeker
          </button>
          <button
            type="button"
            onClick={() => setRole("recruiter")}
            className={`flex-1 px-3 py-1 rounded-full transition ${
              role === "recruiter"
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-slate-300"
            }`}
          >
            Hiring Manager
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs text-slate-400 mb-1">
            You are logging in as{" "}
            <span className="font-semibold text-slate-100">
              {role === "candidate" ? "Job Seeker" : "Hiring Manager"}
            </span>
            .
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Email</label>
            <input
              type="email"
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Password</label>
            <input
              type="password"
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {message && (
            <div
              className={`text-xs rounded-lg px-3 py-2 ${
                message.type === "error"
                  ? "bg-rose-500/10 border border-rose-400/40 text-rose-100"
                  : "bg-emerald-500/10 border border-emerald-400/40 text-emerald-100"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full mt-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold shadow-sm transition
              ${
                loading
                  ? "bg-indigo-500/50 cursor-wait"
                  : "bg-indigo-500 hover:bg-indigo-400"
              } text-white`}
          >
            {loading && (
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            )}
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-slate-400 text-center">
          Don&apos;t have an account?{" "}
          <a href="/register" className="text-indigo-300 hover:text-indigo-200 underline">
            Register now
          </a>
        </p>
      </div>
    </div>
  );
}
