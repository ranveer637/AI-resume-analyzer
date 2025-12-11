// src/App.jsx
import React, { useEffect, useRef, useState, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";

/* ============================
   Utilities: API + Auth helpers
   ============================ */

const API_BASE = import.meta.env.VITE_API_URL || "";

function apiUrl(path) {
  if (!path) return API_BASE;
  return `${API_BASE}${path.startsWith("/") ? path : "/" + path}`;
}

function saveAuth(token, user) {
  try {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  } catch {}
}

function clearAuth() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } catch {}
}

function getAuth() {
  try {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");
    const user = userRaw ? JSON.parse(userRaw) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

async function authFetch(input, opts = {}) {
  try {
    const { token } = getAuth();
    const headers = new Headers(opts.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const merged = { ...opts, headers };
    return fetch(input, merged);
  } catch (err) {
    // Fallback to normal fetch if something goes wrong
    return fetch(input, opts);
  }
}

/* ============================
   Small Error Overlay (helps debug white screens)
   ============================ */

function ErrorOverlay({ error }) {
  if (!error) return null;
  return (
    <div style={{
      position: "fixed", zIndex: 9999, left: 12, right: 12, top: 12,
      background: "rgba(0,0,0,0.85)", color: "white", padding: 12, borderRadius: 8,
      fontSize: 13, boxShadow: "0 8px 30px rgba(0,0,0,0.6)"
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>App error</div>
      <pre style={{ whiteSpace: "pre-wrap", maxHeight: 240, overflow: "auto" }}>{String(error)}</pre>
    </div>
  );
}

/* ============================
   Pages: Login / Register / Home
   (full implementations)
   ============================ */

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => setErr(""), [email, password]);

  const submit = async (e) => {
    e?.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Login failed");
        setLoading(false);
        return;
      }
      saveAuth(data.token, data.user);
      navigate("/");
    } catch (err) {
      console.error(err);
      setErr("Network error during login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-4">
      <div className="w-full max-w-md bg-slate-800 border border-white/5 rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-3">Login</h2>
        {err && <div className="mb-2 text-xs text-rose-300">{err}</div>}
        <form onSubmit={submit} className="space-y-3 text-sm">
          <div>
            <label className="text-xs text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md bg-slate-900 p-2 text-sm outline-none border border-slate-700"
            />
          </div>
          <div>
            <label className="text-xs text-slate-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md bg-slate-900 p-2 text-sm outline-none border border-slate-700"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
            <Link to="/register" className="text-xs text-slate-300 ml-auto">
              Create account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("candidate");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => setErr(""), [fullName, email, password, role]);

  const submit = async (e) => {
    e?.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, role, company }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Registration failed");
        setLoading(false);
        return;
      }
      saveAuth(data.token, data.user);
      navigate("/");
    } catch (err) {
      console.error(err);
      setErr("Network error during registration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-4">
      <div className="w-full max-w-md bg-slate-800 border border-white/5 rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-3">Register</h2>
        {err && <div className="mb-2 text-xs text-rose-300">{err}</div>}
        <form onSubmit={submit} className="space-y-3 text-sm">
          <div>
            <label className="text-xs text-slate-300">Full name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md bg-slate-900 p-2 text-sm outline-none border border-slate-700"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md bg-slate-900 p-2 text-sm outline-none border border-slate-700"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md bg-slate-900 p-2 text-sm outline-none border border-slate-700"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-md bg-slate-900 p-2 text-sm outline-none border border-slate-700"
            >
              <option value="candidate">Candidate</option>
              <option value="recruiter">Recruiter</option>
            </select>
          </div>

          {role === "recruiter" && (
            <div>
              <label className="text-xs text-slate-300">Company name</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="mt-1 w-full rounded-md bg-slate-900 p-2 text-sm outline-none border border-slate-700"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="mt-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500"
            >
              {loading ? "Creating..." : "Create account"}
            </button>
            <Link to="/login" className="text-xs text-slate-300 ml-auto">
              Already have an account?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================
   Home page: Analyzer + Jobs (full)
   ============================ */

function Home() {
  const [fileName, setFileName] = useState("");
  const [parsedText, setParsedText] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");
  const [applyStatus, setApplyStatus] = useState({});

  const fileRef = useRef(null);
  const navigate = useNavigate();

  const { user } = getAuth();

  useEffect(() => {
    const loadJobs = async () => {
      try {
        setJobsLoading(true);
        setJobsError("");
        const res = await fetch(apiUrl("/api/jobs"));
        const data = await res.json();
        if (!res.ok) {
          setJobsError(data.error || "Failed to fetch jobs.");
          return;
        }
        setJobs(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Jobs fetch error:", err);
        setJobsError("Failed to fetch jobs.");
      } finally {
        setJobsLoading(false);
      }
    };
    loadJobs();
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsedText("");
    setKeywords([]);
    setAnalysis(null);

    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/api/parse"), {
        method: "POST",
        body: formData,
      });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { text: raw };
      }

      let displayText = "";
      if (data.text && data.text.trim().length > 0) displayText = data.text;
      else if (data.message) displayText = `⚠️ ${data.message}`;
      else displayText = "No extractable text found (scanned PDF?). Try DOCX/TXT.";

      setParsedText(displayText);
      setKeywords(data.keywords || []);
    } catch (err) {
      console.error("Parse failed:", err);
      setParsedText("Failed to extract text.");
    } finally {
      setLoading(false);
    }

    // After parsing, automatically call analyze
    await analyzeResume();
  };

  const analyzeResume = async () => {
    if (!fileRef.current?.files?.[0] && !parsedText) {
      setAnalysis({ error: "Upload a file or paste text first." });
      return;
    }
    const formData = new FormData();
    if (fileRef.current?.files?.[0]) formData.append("file", fileRef.current.files[0]);
    else formData.append("text", parsedText);

    setLoading(true);
    setAnalysis(null);
    try {
      const res = await fetch(apiUrl("/api/analyze"), {
        method: "POST",
        body: formData,
      });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { error: "Non-JSON AI response", raw };
      }
      setAnalysis(data);
    } catch (err) {
      console.error("Analyze error:", err);
      setAnalysis({ error: "Analysis failed" });
    } finally {
      setLoading(false);
    }
  };

  const atsDisplay = analysis?.atsScore ?? null;

  const handleApplyToJob = async (jobId) => {
    const auth = getAuth();
    if (!auth.user) {
      const go = confirm("Please login as a candidate to apply. Go to login?");
      if (go) navigate("/login");
      return;
    }
    if (auth.user.role !== "candidate") {
      alert("Only candidate accounts can apply to jobs.");
      return;
    }

    setApplyStatus((s) => ({ ...s, [jobId]: "Applying..." }));
    try {
      const fd = new FormData();
      fd.append("candidateName", auth.user.fullName);
      fd.append("candidateEmail", auth.user.email);
      if (atsDisplay != null) fd.append("atsScore", String(atsDisplay));
      fd.append("notes", "Applied via AI Resume Analyzer");

      const file = fileRef.current?.files?.[0];
      if (file) fd.append("file", file, file.name);

      const res = await authFetch(apiUrl(`/api/jobs/${jobId}/apply`), {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setApplyStatus((s) => ({ ...s, [jobId]: data.error || "Failed to apply." }));
        return;
      }
      setApplyStatus((s) => ({ ...s, [jobId]: "✅ Applied" }));
    } catch (err) {
      console.error(err);
      setApplyStatus((s) => ({ ...s, [jobId]: "Failed to apply" }));
    }
  };

  const logout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-900/60">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center font-bold">AI</div>
            <div>
              <h1 className="text-lg font-semibold">AI Resume Analyzer</h1>
              <div className="text-xs text-slate-400">Upload, analyze, apply</div>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <div className="text-xs text-slate-300">Hi, {user.fullName.split(" ")[0]}</div>
                {user.role === "recruiter" && (
                  <Link to="/recruiter-dashboard" className="px-3 py-1 rounded-lg border border-white/5 text-xs">Recruiter</Link>
                )}
                <button onClick={logout} className="px-3 py-1 rounded-lg border border-rose-500/70 text-rose-200">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="px-3 py-1 rounded-lg border border-white/5">Login</Link>
                <Link to="/register" className="px-3 py-1 rounded-lg bg-indigo-600 text-white">Register</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-slate-900/60 p-4 border border-white/5">
            <h3 className="text-base font-semibold mb-3">Upload resume</h3>

            <label className="block border-dashed border-2 border-slate-700 p-6 rounded-lg cursor-pointer text-center">
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileChange} className="hidden" />
              <div>{loading ? "Processing..." : "Click to upload a resume"}</div>
              <div className="text-xs text-slate-400 mt-2">PDF / DOCX / TXT — 20MB max</div>
            </label>

            <div className="mt-3 text-xs">
              Selected: <strong>{fileName || "None"}</strong>
            </div>

            <div className="mt-3">
              <button onClick={analyzeResume} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500">Analyze now</button>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/60 p-4 border border-white/5">
            <h3 className="text-base font-semibold mb-3">ATS Score & Feedback</h3>

            <div className="mb-3">
              <div className="text-xs text-slate-400">ATS Score</div>
              <div className="text-2xl font-bold">{atsDisplay != null ? atsDisplay : "--"}</div>
            </div>

            <div>
              <div className="text-xs text-slate-400">Detected keywords</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {keywords.length === 0 ? <div className="text-xs text-slate-500">No keywords detected yet</div> : keywords.map((k, i) => <span key={i} className="px-2 py-1 rounded-full bg-indigo-600/20 text-xs">{k}</span>)}
              </div>
            </div>

            <div className="mt-4 text-xs">
              <div className="font-semibold">AI Suggestions</div>
              {!analysis && <div className="text-slate-400 mt-2">Upload & analyze to see suggestions</div>}
              {analysis?.error && <div className="text-rose-300 mt-2 text-xs">{analysis.error}</div>}
              {analysis && !analysis.error && (
                <div className="mt-2 space-y-2 text-sm">
                  {analysis.topSkills && analysis.topSkills.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold">Top skills</div>
                      <div className="flex flex-wrap gap-2 mt-1">{analysis.topSkills.map((s, i) => <span key={i} className="px-2 py-1 rounded bg-emerald-600/20 text-xs">{s}</span>)}</div>
                    </div>
                  )}
                  {analysis.suggestions && analysis.suggestions.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold">Suggestions</div>
                      <ul className="list-disc list-inside text-xs mt-1">{analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900/60 p-4 border border-white/5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Open job positions</h3>
            {jobsLoading && <div className="text-xs text-slate-400">Loading...</div>}
          </div>

          {jobsError && <div className="text-xs text-rose-300 mt-2">{jobsError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {jobs.map((job) => (
              <div key={job._id} className="p-3 rounded-lg bg-slate-950/50 border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{job.title}</div>
                    <div className="text-xs text-slate-400">{job.companyName} • {job.location || "Not specified"}</div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="text-xs text-slate-300 mt-2 line-clamp-3">{job.qualifications}</div>
                {job.description && <div className="text-xs text-slate-400 mt-1 line-clamp-3">{job.description}</div>}

                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => handleApplyToJob(job._id)} className="px-3 py-1.5 rounded bg-indigo-600 text-sm">Apply with resume</button>
                  <div className="text-xs text-emerald-300">{applyStatus[job._id]}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="text-center py-4 text-xs text-slate-500">© {new Date().getFullYear()} AI Resume Analyzer</footer>
    </div>
  );
}

/* ============================
   Lazy-load recruiter dashboard (safe)
   ============================ */

const RecruiterDashboardLazy = React.lazy(() =>
  import("./RecruiterDashboard.jsx").catch((err) => {
    // propagate error so Suspense fallback + overlay shows it
    throw err;
  })
);

/* ============================
   Root App (default export)
   ============================ */

export default function AppWrapper() {
  // error overlay state
  const [appError, setAppError] = useState(null);

  // global error boundary-ish
  useEffect(() => {
    function onError(e) {
      setAppError(e?.error || e?.message || String(e));
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", (ev) => onError(ev?.reason || ev));
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", (ev) => onError(ev?.reason || ev));
    };
  }, []);

  return (
    <>
      <ErrorOverlay error={appError} />
      <Router>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/recruiter-dashboard"
              element={
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading dashboard...</div>}>
                  <RecruiterDashboardLazy />
                </Suspense>
              }
            />
          </Routes>
        </Suspense>
      </Router>
    </>
  );
}
