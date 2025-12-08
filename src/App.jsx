// src/App.jsx
import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";

export default function App() {
  const [fileName, setFileName] = useState("");
  const [parsedText, setParsedText] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [skillsFound, setSkillsFound] = useState([]);
  const [topTokens, setTopTokens] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const fileRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_URL || "";
  const apiUrl = (p) => `${API_BASE}${p.startsWith("/") ? p : "/" + p}`;

  // Upload + parse
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setParsedText("");
    setKeywords([]);
    setSkillsFound([]);
    setTopTokens([]);
    setAnalysis(null);

    const formData = new FormData();
    formData.append("file", file);

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

      setParsedText(data.text || "(No text extracted)");
      setKeywords(data.keywords || []);
      setSkillsFound(data.skillsFound || []);
      setTopTokens(data.topTokens || []);
    } catch (err) {
      console.error("Parse failed:", err);
      setParsedText("Error extracting text. Try another PDF/DOCX/TXT.");
    } finally {
      setLoading(false);
    }
  };

  // Analyze with AI
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

      try {
        const data = JSON.parse(raw);
        setAnalysis(data);
      } catch (e) {
        setAnalysis({
          error: "Non-JSON response from server",
          raw,
          status: res.status,
        });
      }
    } catch (err) {
      console.error("Analyze failed:", err);
      setAnalysis({
        error: err.message || "Failed to analyze resume.",
      });
    } finally {
      setLoading(false);
    }
  };

  const atsScore = analysis?.atsScore ?? null;
  const atsDisplay =
    atsScore !== null && !Number.isNaN(atsScore)
      ? Math.min(100, Math.max(0, Number(atsScore)))
      : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Background Gradient */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#4f46e5_0,_transparent_55%),radial-gradient(circle_at_bottom,_#0ea5e9_0,_transparent_55%)] opacity-30" />
      </div>

      {/* Header with Login + Register */}
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-indigo-500 flex items-center justify-center text-sm font-bold">
              AI
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                AI Resume Analyzer
              </h1>
              <p className="text-xs text-slate-400">
                ATS-friendly resume insights
              </p>
            </div>
          </div>

          {/* Right Section — Navigation */}
          <nav className="flex items-center gap-2 text-xs">
  <Link to="/" className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5">
    Analyzer
  </Link>

  <Link to="/recruiter-dashboard" className="px-3 py-1.5 rounded-lg border border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10">
    Recruiter Dashboard
  </Link>

  <Link to="/login" className="px-3 py-1.5 rounded-lg border border-slate-600 hover:bg-white/5">
    Login
  </Link>

  <Link to="/register" className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white">
    Register
  </Link>
</nav>

        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 md:py-10">
        {/* Steps Overview */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <span className="text-xs text-slate-400 uppercase">Step 1 · Upload</span>
            <p className="text-sm">Upload PDF/DOCX/TXT to extract resume text.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <span className="text-xs text-slate-400 uppercase">Step 2 · Keywords</span>
            <p className="text-sm">We detect important skills and keywords.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <span className="text-xs text-slate-400 uppercase">Step 3 · AI Analysis</span>
            <p className="text-sm">AI gives ATS score + suggestions.</p>
          </div>
        </section>

        {/* Main Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel */}
          <div className="space-y-4">
            {/* Upload Section */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h2 className="text-base font-semibold mb-2">Upload Resume</h2>

              <label className="flex flex-col items-center justify-center border border-dashed border-slate-600/80 hover:border-indigo-400/80 transition-colors rounded-xl px-4 py-6 cursor-pointer bg-slate-900/70">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="text-slate-200 font-medium">Click to upload</span>
                <span className="text-xs text-slate-400">
                  PDF, DOCX or TXT · up to 15MB
                </span>
              </label>

              <div className="text-xs text-slate-400 mt-3">
                Selected: {fileName || "No file selected"}
              </div>

              <button
                onClick={analyzeResume}
                disabled={loading}
                className={`mt-3 w-full px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  loading
                    ? "bg-indigo-500/40 cursor-wait"
                    : "bg-indigo-500 hover:bg-indigo-400"
                }`}
              >
                {loading ? "Analyzing..." : "Analyze with AI"}
              </button>
            </div>

            {/* Extracted Text */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold mb-2">Extracted Resume Text</h3>
              <div className="h-56 overflow-y-auto rounded-xl bg-slate-950/60 border border-white/5 p-3 text-xs whitespace-pre-wrap">
                {parsedText || "Upload a resume to see extracted text."}
              </div>
            </div>

            {/* Keywords */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold mb-1">Detected Keywords</h3>

              {keywords.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Upload a resume to extract keywords.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((k, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/40 text-[11px]"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel — AI Output */}
          <div className="space-y-4">
            {/* ATS Score */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold mb-3">ATS Score</h3>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center">
                  <div className="absolute inset-[6px] rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 opacity-90" />
                  <div className="absolute inset-[14px] rounded-full bg-slate-950 flex items-center justify-center">
                    <span className="text-lg font-bold">
                      {atsDisplay !== null ? atsDisplay : "--"}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-300">
                  Higher ATS score improves chances of passing automated filters.
                </p>
              </div>
            </div>

            {/* AI Suggestions Panel */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold mb-3">AI Feedback & Suggestions</h3>

              {!analysis && (
                <p className="text-xs text-slate-400">
                  Upload a resume and click Analyze to see results.
                </p>
              )}

              {analysis?.error && (
                <div className="p-3 bg-rose-500/10 border border-rose-400/40 rounded-lg text-xs text-rose-200">
                  <strong>Error:</strong> {analysis.error}
                  {analysis.raw && (
                    <pre className="mt-2 whitespace-pre-wrap text-[10px]">
                      {analysis.raw}
                    </pre>
                  )}
                </div>
              )}

              {analysis && !analysis.error && (
                <div className="text-xs space-y-3">
                  {analysis.topSkills && (
                    <div>
                      <h4 className="font-semibold mb-1">Top Skills</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.topSkills.map((s, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-emerald-500/15 border border-emerald-400/40 rounded-full text-[11px]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.suggestions && (
                    <div>
                      <h4 className="font-semibold mb-1">Suggestions</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {analysis.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.rewrittenBullets && (
                    <div>
                      <h4 className="font-semibold mb-1">Improved Bullet Points</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {analysis.rewrittenBullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950/80 text-center text-[11px] text-slate-500 py-3">
        © {new Date().getFullYear()} AI Resume Analyzer • Built with React + Express
      </footer>
    </div>
  );
}
