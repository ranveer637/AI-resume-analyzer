// src/App.jsx
import React, { useState, useRef } from "react";

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
  const handleFileChange = async (e) => {// src/App.jsx
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

      {/* 🔥 Header with Login + Register */}
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
            <Link
              to="/"
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-white/10 text-slate-200 hover:bg-white/5 transition"
            >
              Analyzer
            </Link>

            <Link
              to="/login"
              className="inline-flex px-3 py-1.5 rounded-lg text-slate-100 hover:bg-white/5 border border-slate-500/60 transition"
            >
              Login
            </Link>

            <Link
              to="/register"
              className="inline-flex px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold shadow-sm transition"
            >
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
                    <pre className="mt-2 whitespace-pre-wrap text-[10px]">{analysis.raw}</pre>
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
      setKeywords([]);
      setSkillsFound([]);
      setTopTokens([]);
    } finally {
      setLoading(false);
    }
  };

  // Analyze with AI
  const analyzeResume = async () => {
    if (!fileRef.current?.files?.[0] && !parsedText) {
      setAnalysis({ error: "Please upload a file or provide resume text." });
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
          status: res.status,
          raw,
        });
      }
    } catch (err) {
      console.error("Analyze failed:", err);
      setAnalysis({ error: err.message || "Failed to analyze resume." });
    } finally {
      setLoading(false);
    }
  };

  const atsScore = analysis?.atsScore ?? null;
  const atsDisplay = atsScore !== null && !Number.isNaN(atsScore)
    ? Math.min(100, Math.max(0, Number(atsScore)))
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Gradient background overlay */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#4f46e5_0,_transparent_55%),radial-gradient(circle_at_bottom,_#0ea5e9_0,_transparent_55%)] opacity-30" />
      </div>

      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-indigo-500 flex items-center justify-center text-sm font-bold">
              AI
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                AI Resume Analyzer
              </h1>
              <p className="text-xs text-slate-400">
                ATS-friendly insights powered by AI & keyword extraction
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-400/30">
              Live
            </span>
            <span>Backend: Express · Frontend: React + Vite</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 md:py-10">
        {/* Top summary cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 flex flex-col gap-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Step 1 · Upload
            </span>
            <p className="text-sm text-slate-200">
              Upload your resume as <span className="font-semibold">PDF</span>,{" "}
              <span className="font-semibold">DOCX</span>, or{" "}
              <span className="font-semibold">TXT</span> to extract its content.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 flex flex-col gap-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Step 2 · Keywords
            </span>
            <p className="text-sm text-slate-200">
              We detect <span className="font-semibold">skills & keywords</span>{" "}
              that ATS systems look for, and highlight them for you.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 flex flex-col gap-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Step 3 · AI Analysis
            </span>
            <p className="text-sm text-slate-200">
              Get an <span className="font-semibold">ATS score</span>, detailed{" "}
              <span className="font-semibold">suggestions</span>, and improved{" "}
              <span className="font-semibold">bullet points</span>.
            </p>
          </div>
        </section>

        {/* Main layout */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Upload + Preview + Keywords */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-indigo-500/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-semibold">
                    Upload Resume & Preview
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    We do not store your files. Everything is processed in-memory.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="flex flex-col items-center justify-center border border-dashed border-slate-600/80 hover:border-indigo-400/80 transition-colors rounded-xl px-4 py-6 cursor-pointer bg-slate-900/70">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-1 text-sm">
                    <span className="text-slate-200 font-medium">
                      Click to upload or drag & drop
                    </span>
                    <span className="text-xs text-slate-400">
                      PDF, DOCX or TXT · up to 15MB
                    </span>
                  </div>
                </label>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="truncate">
                    <span className="font-medium text-slate-300">
                      Selected:
                    </span>{" "}
                    {fileName || "No file selected yet"}
                  </div>

                  <button
                    onClick={analyzeResume}
                    disabled={loading}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition
                      ${
                        loading
                          ? "bg-indigo-500/40 text-indigo-100 cursor-wait"
                          : "bg-indigo-500 hover:bg-indigo-400 text-white"
                      }`}
                  >
                    {loading ? (
                      <>
                        <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Analyzing…
                      </>
                    ) : (
                      "Analyze with AI"
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Extracted text */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Extracted Resume Text</h3>
                <span className="text-[10px] text-slate-500">
                  Preview only – original formatting may not be preserved
                </span>
              </div>
              <div className="h-60 overflow-y-auto rounded-xl bg-slate-950/60 border border-white/5 p-3 text-xs text-slate-200 whitespace-pre-wrap">
                {parsedText || "Upload a resume to see the extracted text here."}
              </div>
            </div>

            {/* Keywords */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Detected Keywords</h3>
                <span className="text-[11px] text-slate-500">
                  Based on local keyword extraction
                </span>
              </div>

              {keywords.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No keywords detected yet. Upload a resume to extract skills and keywords.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {keywords.map((k, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/40 text-[11px] text-indigo-100"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                  {skillsFound.length > 0 && (
                    <p className="text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-200">
                        Skills detected:
                      </span>{" "}
                      {skillsFound.join(", ")}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* RIGHT: AI Analysis & Score */}
          <div className="space-y-4">
            {/* ATS Score card */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">ATS Compatibility Score</h3>
                  <p className="text-xs text-slate-400">
                    Higher scores usually mean better chances of passing ATS filters.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-2">
                <div className="relative h-20 w-20 rounded-full bg-slate-900 flex items-center justify-center border border-white/10">
                  <div className="absolute inset-[6px] rounded-full bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 opacity-90" />
                  <div className="absolute inset-[14px] rounded-full bg-slate-950 flex items-center justify-center">
                    <span className="text-lg font-bold">
                      {atsDisplay !== null ? atsDisplay : "--"}
                    </span>
                  </div>
                </div>

                <div className="flex-1 text-xs text-slate-300 space-y-1">
                  {atsDisplay === null ? (
                    <p>
                      Run the AI analysis to see your ATS score and get personalized suggestions.
                    </p>
                  ) : (
                    <>
                      <p>
                        Your resume scored{" "}
                        <span className="font-semibold text-indigo-300">
                          {atsDisplay}/100
                        </span>{" "}
                        for ATS compatibility.
                      </p>
                      <p className="text-slate-400">
                        Use the suggestions below to improve structure, keyword density, and clarity.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* AI Analysis */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 h-full">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">AI Feedback & Suggestions</h3>
                <span className="text-[11px] text-slate-500">
                  Powered by OpenAI · No data stored
                </span>
              </div>

              {!analysis && (
                <p className="text-xs text-slate-400">
                  Upload a resume and click{" "}
                  <span className="font-semibold text-indigo-300">Analyze with AI</span>{" "}
                  to see ATS score, suggestions, and improved bullet points here.
                </p>
              )}

              {analysis?.error && (
                <div className="mt-2 bg-rose-500/10 border border-rose-400/40 text-rose-100 rounded-xl p-3 text-xs">
                  <strong className="font-semibold">Error:</strong> {analysis.error}
                  {analysis.status && <div>Status: {analysis.status}</div>}
                  {analysis.details && (
                    <div className="mt-1 text-[10px] text-rose-200/80">
                      Details: {analysis.details}
                    </div>
                  )}
                  {analysis.raw && (
                    <>
                      <div className="mt-2 font-semibold text-[11px]">
                        Raw server response:
                      </div>
                      <pre className="mt-1 max-h-32 overflow-y-auto bg-slate-950/70 border border-white/5 rounded-md p-2 text-[10px]">
                        {analysis.raw}
                      </pre>
                    </>
                  )}
                </div>
              )}

              {analysis && !analysis.error && (
                <div className="mt-3 space-y-4 text-xs text-slate-200">
                  {analysis.topSkills && analysis.topSkills.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Top Skills Highlighted</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.topSkills.map((skill, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[11px] text-emerald-100"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.keywords && analysis.keywords.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">AI Keywords</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.keywords.map((k, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 rounded-full bg-sky-500/15 border border-sky-400/40 text-[11px] text-sky-100"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.suggestions && analysis.suggestions.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Suggestions to Improve</h4>
                      <ul className="list-disc list-inside space-y-1 text-slate-200">
                        {analysis.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.rewrittenBullets && analysis.rewrittenBullets.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">
                        Improved Resume Bullet Points
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-slate-200">
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

      <footer className="border-t border-white/10 bg-slate-950/80">
        <div className="max-w-6xl mx-auto px-4 py-3 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} AI Resume Analyzer</span>
          <span>
            Built with{" "}
            <span className="text-slate-300 font-medium">React · Express · Tailwind</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
