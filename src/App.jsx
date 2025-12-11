// src/App.jsx
import React, { useEffect, useRef, useState, Suspense } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";

/* ------------------------
   Config + auth helpers
   ------------------------ */
const API_BASE = import.meta.env.VITE_API_URL || "";
const apiUrl = (p) => `${API_BASE}${p.startsWith("/") ? p : "/" + p}`;

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
    const raw = localStorage.getItem("user");
    return { token, user: raw ? JSON.parse(raw) : null };
  } catch {
    return { token: null, user: null };
  }
}

async function authFetch(input, opts = {}) {
  const { token } = getAuth();
  const headers = new Headers(opts.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const merged = { ...opts, headers };
  return fetch(input, merged);
}

/* ------------------------
   Login / Register Pages
   ------------------------ */

function LoginPage({ onLogin }) {
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

      // Save token and user
      saveAuth(data.token, data.user);
      onLogin?.(data.user);

      // Normalize role check and redirect accordingly
      const role = (data.user?.role || "").toString().toLowerCase();
      if (role === "recruiter") {
        navigate("/recruiter-dashboard");
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error("Login error:", err);
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

function RegisterPage({ onLogin }) {
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
      onLogin?.(data.user);

      const r = (data.user?.role || "").toString().toLowerCase();
      if (r === "recruiter") navigate("/recruiter-dashboard");
      else navigate("/");
    } catch (err) {
      console.error("Register error:", err);
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

/* ------------------------
   Home (analyzer + jobs) - your main UI
   ------------------------ */

function Home({ currentUser, setCurrentUser }) {
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

  // parse + analyze
  const analyzeResume = async () => {
    if (!fileRef.current?.files?.[0] && !parsedText) {
      setAnalysis({ error: "Please upload a file first." });
      return;
    }

    const formData = new FormData();
    if (fileRef.current?.files?.[0]) {
      formData.append("file", fileRef.current.files[0]);
    } else {
      formData.append("text", parsedText);
    }

    try {
      setLoading(true);
      setAnalysis(null);

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
      console.error("Analyze failed:", err);
      setAnalysis({
        error: err.message || "Failed to analyze resume.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setParsedText("");
    setKeywords([]);
    setAnalysis(null);

    const formData = new FormData();
    formData.append("file", file);

    // 1) Parse resume text
    try {
      setLoading(true);

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
      if (data.text && data.text.trim().length > 0) {
        displayText = data.text;
      } else if (data.message) {
        displayText = `⚠️ ${data.message}`;
      } else {
        displayText =
          "⚠️ No extractable text found. This can happen if the PDF is scanned or image-only. Try exporting your resume again as a text-based PDF or upload DOCX/TXT.";
      }

      setParsedText(displayText);
      setKeywords(data.keywords || []);
    } catch (err) {
      console.error("Parse failed:", err);
      setParsedText(
        "❌ Failed to extract text. Try another PDF/DOCX/TXT or re-export your resume."
      );
    } finally {
      setLoading(false);
    }

    // 2) Automatically run AI analysis
    await analyzeResume();
  };

  const atsScore = analysis?.atsScore ?? null;
  const atsDisplay =
    atsScore !== null && !Number.isNaN(atsScore)
      ? Math.min(100, Math.max(0, Number(atsScore)))
      : null;

  // Candidate applies to a job (with resume file if available)
  const handleApplyToJob = async (jobId) => {
    const { token, user } = getAuth();
    if (!user || user.role !== "candidate") {
      alert("Please login as a candidate to apply.");
      navigate("/login");
      return;
    }

    try {
      setApplyStatus((s) => ({ ...s, [jobId]: "Applying..." }));

      const formData = new FormData();
      formData.append("candidateName", user.fullName);
      formData.append("candidateEmail", user.email);
      if (atsDisplay != null) formData.append("atsScore", String(atsDisplay));
      formData.append("notes", "Applied via AI Resume Analyzer");

      const file = fileRef.current?.files?.[0];
      if (file) {
        formData.append("file", file, file.name);
      }

      // use authFetch to include token
      const res = await authFetch(apiUrl(`/api/jobs/${jobId}/apply`), {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setApplyStatus((s) => ({ ...s, [jobId]: data.error || "Failed to apply." }));
        return;
      }

      setApplyStatus((s) => ({ ...s, [jobId]: "✅ Application submitted!" }));
    } catch (err) {
      console.error("Apply error:", err);
      setApplyStatus((s) => ({ ...s, [jobId]: "Failed to apply. Please try again." }));
    }
  };

  // UI:
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#4f46e5_0,_transparent_55%),radial-gradient(circle_at_bottom,_#0ea5e9_0,_transparent_55%)] opacity-30" />
      </div>

      {/* HEADER */}
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-indigo-500 flex items-center justify-center text-sm font-bold">
              AI
            </div>
            <div>
              <h1 className="text-lg font-semibold">AI Resume Analyzer</h1>
              <p className="text-xs text-slate-400">
                ATS-friendly resume insights & job matching
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2 text-xs">
            <Link
              to="/"
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
            >
              Analyzer
            </Link>

            {currentUser?.role === "recruiter" && (
              <Link
                to="/recruiter-dashboard"
                className="px-3 py-1.5 rounded-lg border border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
              >
                Recruiter Dashboard
              </Link>
            )}

            {!currentUser && (
              <>
                <Link
                  to="/login"
                  className="px-3 py-1.5 rounded-lg border border-slate-600 hover:bg-white/5"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white"
                >
                  Register
                </Link>
              </>
            )}

            {currentUser && (
              <>
                <span className="hidden sm:inline text-[11px] text-slate-300 mr-1">
                  Hi, {currentUser.fullName.split(" ")[0]}
                </span>
                <button
                  onClick={() => {
                    clearAuth();
                    setCurrentUser(null);
                    navigate("/login");
                  }}
                  className="px-3 py-1.5 rounded-lg border border-rose-500/70 text-rose-200 hover:bg-rose-500/10"
                >
                  Logout
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* MAIN - simplified: only the analyzer UI and job list */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 space-y-8">
        {/* Steps */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            Upload resume
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            Extract keywords & ATS score
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            Apply to matching jobs
          </div>
        </section>

        {/* Analyzer + ATS */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT PANEL */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h2 className="text-base font-semibold mb-3">Upload Resume</h2>

              <label className="border border-dashed border-slate-600 rounded-xl px-4 py-6 cursor-pointer bg-slate-900/70 flex flex-col items-center">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="font-medium">
                  {loading ? "Processing..." : "Click to upload"}
                </span>
                <span className="text-xs text-slate-400">
                  PDF, DOCX, TXT • 20MB max
                </span>
              </label>

              <p className="mt-2 text-xs text-slate-400">
                Selected: {fileName || "None"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold mb-2">Extracted Resume Text</h3>
              <div className="h-56 overflow-y-auto bg-slate-950/60 border border-white/5 rounded-xl p-3 text-xs whitespace-pre-wrap">
                {parsedText || "Upload a resume to extract text."}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold mb-2">Detected Keywords</h3>
              {keywords.length === 0 ? (
                <p className="text-xs text-slate-400">Upload a resume to extract keywords.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((k, i) => (
                    <span key={i} className="px-2 py-1 bg-indigo-500/15 border border-indigo-400/40 rounded-full text-[11px]">
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold">ATS Score</h3>
              <div className="flex items-center gap-4 mt-3">
                <div className="relative h-20 w-20 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center">
                  <div className="absolute inset-[6px] rounded-full bg-gradient-to-br from-indigo-500 to-sky-500" />
                  <div className="absolute inset-[14px] rounded-full bg-slate-950 flex items-center justify-center">
                    <span className="text-lg font-bold">{atsDisplay !== null ? atsDisplay : "--"}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">Higher ATS score increases chance of passing filters.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold mb-2">AI Feedback & Suggestions</h3>

              {!analysis && <p className="text-xs text-slate-500">Upload a resume to see AI feedback.</p>}

              {analysis?.error && (
                <div className="text-xs bg-red-500/20 border border-red-500/40 p-3 rounded-lg text-red-200">
                  <strong>Error:</strong> {analysis.error}
                  {analysis.details && <div className="mt-1 text-[10px] opacity-80">{analysis.details}</div>}
                </div>
              )}

              {analysis && !analysis.error && (
                <div className="text-xs space-y-3">
                  {analysis.topSkills?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Top Skills</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.topSkills.map((s, i) => (
                          <span key={i} className="px-2 py-1 bg-emerald-500/20 rounded-full text-[11px]">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.suggestions?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Suggestions</h4>
                      <ul className="list-disc list-inside space-y-1">{analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}

                  {analysis.rewrittenBullets?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Improved Bullet Points</h4>
                      <ul className="list-disc list-inside space-y-1">{analysis.rewrittenBullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
                    </div>
                  )}

                  {analysis.raw && (
                    <details className="mt-2 text-[10px] text-slate-400"><summary>Raw AI response</summary><pre className="whitespace-pre-wrap mt-1">{analysis.raw}</pre></details>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* JOB LISTINGS FOR CANDIDATE */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Open Positions</h2>
            {jobsLoading && <span className="text-[11px] text-slate-400">Loading jobs...</span>}
          </div>

          {jobsError && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/40 rounded p-2">{jobsError}</div>}

          {jobs.length === 0 && !jobsLoading && !jobsError && <p className="text-xs text-slate-400">No jobs posted yet. Check back later.</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map(job => (
              <div key={job._id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4 flex flex-col gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{job.title} <span className="text-[11px] text-slate-400">• {job.companyName}</span></h3>
                  <p className="text-[11px] text-slate-400">{job.location || "Not specified"}</p>
                </div>

                <div className="text-[11px] text-slate-300 line-clamp-3 whitespace-pre-wrap"><strong>Required qualifications:</strong> {job.qualifications}</div>

                {job.description && <div className="text-[11px] text-slate-400 line-clamp-3 whitespace-pre-wrap">{job.description}</div>}

                <button onClick={() => handleApplyToJob(job._id)} className="mt-1 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-[11px] font-semibold self-start">
                  Apply with this resume
                </button>

                {applyStatus[job._id] && <p className="text-[11px] mt-1 text-emerald-300">{applyStatus[job._id]}</p>}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 text-center py-3 text-[11px] text-slate-500">
        © {new Date().getFullYear()} AI Resume Analyzer • Built with React + Express + MongoDB
      </footer>
    </div>
  );
}

/* ------------------------
   Router wrapper (default export)
   ------------------------ */

export default function AppRouterWrapper() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        setCurrentUser(JSON.parse(raw));
      } catch {}
    }
  }, []);

  const onLogin = (user) => {
    setCurrentUser(user);
  };

  const RecruiterDashboardLazy = React.lazy(() =>
    import("./RecruiterDashboard.jsx").catch(() => ({ default: () => <div className="p-6">Recruiter dashboard not available.</div> }))
  );

  return (
    <Routes>
      <Route path="/" element={<Home currentUser={currentUser} setCurrentUser={setCurrentUser} />} />
      <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
      <Route path="/register" element={<RegisterPage onLogin={onLogin} />} />
      <Route
        path="/recruiter-dashboard"
        element={
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading dashboard...</div>}>
            <RecruiterDashboardLazy />
          </Suspense>
        }
      />
    </Routes>
  );
}
