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

  // -----------------------------------------------------
  // Analyze Resume with AI
  // -----------------------------------------------------
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
      setAnalysis({
        error: err.message || "Failed to analyze resume.",
      });
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------
  // Upload + PARSE + Auto AI-Analyze
  // -----------------------------------------------------
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

      setParsedText(data.text || "");
      setKeywords(data.keywords || []);
      setSkillsFound(data.skillsFound || []);
      setTopTokens(data.topTokens || []);
    } catch (err) {
      setParsedText("❌ Failed to extract text.");
    } finally {
      setLoading(false);
    }

    // 2) Automatically run AI analysis (no need to click button)
    await analyzeResume();
  };

  const atsScore = analysis?.atsScore ?? null;
  const atsDisplay =
    atsScore !== null && !Number.isNaN(atsScore)
      ? Math.min(100, Math.max(0, Number(atsScore)))
      : null;

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
            <div className="h-9 w-9 rounded-xl bg-indigo-500 flex items-center justify-center text-sm font-bold">AI</div>
            <div>
              <h1 className="text-lg font-semibold">AI Resume Analyzer</h1>
              <p className="text-xs text-slate-400">ATS-friendly resume insights</p>
            </div>
          </div>

          <nav className="flex items-center gap-2 text-xs">
            <Link to="/" className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5">
              Analyzer
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

      {/* MAIN */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">

        {/* Steps */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">Upload resume</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">Extract keywords</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">AI feedback</div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT PANEL */}
          <div className="space-y-4">

            {/* Upload */}
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
                <span className="font-medium">Click to upload</span>
                <span className="text-xs text-slate-400">PDF, DOCX, TXT • 15MB max</span>
              </label>

              <p className="mt-2 text-xs text-slate-400">
                Selected: {fileName || "None"}
              </p>
            </div>

            {/* Extracted text */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold mb-2">Extracted Resume Text</h3>
              <div className="h-56 overflow-y-auto bg-slate-950/60 border border-white/5 rounded-xl p-3 text-xs whitespace-pre-wrap">
                {parsedText || "Upload a resume to extract text."}
              </div>
            </div>

            {/* Keywords */}
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

            {/* ATS Score */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold">ATS Score</h3>
              <div className="flex items-center gap-4 mt-3">
                <div className="relative h-20 w-20 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center">
                  <div className="absolute inset-[6px] rounded-full bg-gradient-to-br from-indigo-500 to-sky-500" />
                  <div className="absolute inset-[14px] rounded-full bg-slate-950 flex items-center justify-center">
                    <span className="text-lg font-bold">
                      {atsDisplay !== null ? atsDisplay : "--"}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Higher ATS score increases your chance of passing filters.
                </p>
              </div>
            </div>

            {/* AI Feedback */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold mb-2">AI Feedback & Suggestions</h3>

              {!analysis && (
                <p className="text-xs text-slate-500">Upload a resume to see AI feedback.</p>
              )}

              {analysis?.error && (
                <div className="text-xs bg-red-500/20 border border-red-500/40 p-3 rounded-lg text-red-200">
                  <strong>Error:</strong> {analysis.error}
                </div>
              )}

              {analysis && !analysis.error && (
                <div className="text-xs space-y-3">

                  {/* Top Skills */}
                  {analysis.topSkills?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Top Skills</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.topSkills.map((s, i) => (
                          <span key={i} className="px-2 py-1 bg-emerald-500/20 rounded-full text-[11px]">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {analysis.suggestions?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Suggestions</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {analysis.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Rewritten Bullet Points */}
                  {analysis.rewrittenBullets?.length > 0 && (
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

      <footer className="border-t border-white/10 text-center py-3 text-[11px] text-slate-500">
        © {new Date().getFullYear()} AI Resume Analyzer • Built with React + Express
      </footer>
    </div>
  );
}

