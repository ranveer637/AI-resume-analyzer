// src/App.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function App() {
  const [fileName, setFileName] = useState("");
  const [parsedText, setParsedText] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [skillsFound, setSkillsFound] = useState([]);
  const [topTokens, setTopTokens] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);

  // Jobs for candidates
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");
  const [applyStatus, setApplyStatus] = useState({}); // jobId -> message

  // Recruiter: applications view
  const [recruiterApps, setRecruiterApps] = useState([]); // array of { jobId, jobTitle, applications: [...] }
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState("");
  const [selectedJobForView, setSelectedJobForView] = useState(null);

  const fileRef = useRef(null);
  const navigate = useNavigate();

  const API_BASE = import.meta.env.VITE_API_URL || "";
  const apiUrl = (p) => `${API_BASE}${p.startsWith("/") ? p : "/" + p}`;

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        setCurrentUser(JSON.parse(raw));
      }
    } catch {
      setCurrentUser(null);
    }
  }, []);

  // Load jobs for candidates
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
  }, []); // run once

  // If user is recruiter, load applications grouped by job
  useEffect(() => {
    if (!currentUser || currentUser.role !== "recruiter") return;

    const loadApplications = async () => {
      try {
        setAppsLoading(true);
        setAppsError("");

        const res = await fetch(
          apiUrl(`/api/recruiter/applications?recruiterEmail=${currentUser.email}`),
          { headers: { "Content-Type": "application/json" } }
        );

        const data = await res.json();

        if (!res.ok) {
          setAppsError(data.error || "Failed to fetch applications.");
          return;
        }

        setRecruiterApps(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Recruiter applications fetch error:", err);
        setAppsError("Failed to fetch applications.");
      } finally {
        setAppsLoading(false);
      }
    };

    loadApplications();
  }, [currentUser]);


  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setCurrentUser(null);
    navigate("/login");
  };

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
      console.error("Analyze failed:", err);
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
      setSkillsFound(data.skillsFound || []);
      setTopTokens(data.topTokens || []);
    } catch (err) {
      console.error("Parse failed:", err);
      setParsedText(
        "❌ Failed to extract text. Try another PDF/DOCX/TXT or re-export your resume."
      );
    } finally {
      setLoading(false);
    }

    // 2) Automatically run AI analysis (even if parse was partial)
    await analyzeResume();
  };

  const atsScore = analysis?.atsScore ?? null;
  const atsDisplay =
    atsScore !== null && !Number.isNaN(atsScore)
      ? Math.min(100, Math.max(0, Number(atsScore)))
      : null;

  // -----------------------------------------------------
  // -----------------------------------------------------
  // Candidate applies to a job (FIXED)
  // -----------------------------------------------------
  const handleApplyToJob = async (jobId) => {
    if (!currentUser) {
      alert("Please login as a candidate to apply.");
      navigate("/login");
      return;
    }

    if (currentUser.role !== "candidate") {
      alert("Only candidate accounts can apply to jobs.");
      return;
    }

    if (!parsedText || !parsedText.trim()) {
      alert("Please upload your resume first.");
      return;
    }

    try {
      setLoading(true);

      const body = {
        candidateName: currentUser.fullName,   // ✅ REQUIRED
        candidateEmail: currentUser.email,     // ✅ REQUIRED
        atsScore: atsDisplay ?? null,
        resumeText: parsedText,                // ✅ BACKEND USES THIS TO CREATE PDF
        notes: "Applied via AI Resume Analyzer",
      };

      const res = await fetch(apiUrl(`/api/jobs/${jobId}/apply`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setApplyStatus((prev) => ({
          ...prev,
          [jobId]: data.error || "Failed to apply.",
        }));
        return;
      }

      setApplyStatus((prev) => ({
        ...prev,
        [jobId]: "✅ Application submitted!",
      }));
    } catch (err) {
      console.error("Apply error:", err);
      setApplyStatus((prev) => ({
        ...prev,
        [jobId]: "Failed to apply. Please try again.",
      }));
    } finally {
      setLoading(false);
    }
  };


  // Helper: toggle selected job in recruiter view
  const toggleSelectJob = (jobId) => {
    setSelectedJobForView((prev) => (prev === jobId ? null : jobId));
  };

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
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg border border-rose-500/70 text-rose-200 hover:bg-rose-500/10"
                >
                  Logout
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* MAIN */}
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
                <span className="font-medium">
                  {loading ? "Processing..." : "Click to upload"}
                </span>
                <span className="text-xs text-slate-400">
                  PDF, DOCX, TXT • 15MB max
                </span>
              </label>

              <p className="mt-2 text-xs text-slate-400">
                Selected: {fileName || "None"}
              </p>
            </div>

            {/* Extracted text */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold mb-2">
                Extracted Resume Text
              </h3>
              <div className="h-56 overflow-y-auto bg-slate-950/60 border border-white/5 rounded-xl p-3 text-xs whitespace-pre-wrap">
                {parsedText || "Upload a resume to extract text."}
              </div>
            </div>

            {/* Keywords */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold mb-2">Detected Keywords</h3>

              {keywords.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Upload a resume to extract keywords.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((k, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-indigo-500/15 border border-indigo-400/40 rounded-full text-[11px]"
                    >
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
              <h3 className="text-sm font-semibold mb-2">
                AI Feedback & Suggestions
              </h3>

              {!analysis && (
                <p className="text-xs text-slate-500">
                  Upload a resume to see AI feedback.
                </p>
              )}

              {analysis?.error && (
                <div className="text-xs bg-red-500/20 border border-red-500/40 p-3 rounded-lg text-red-200">
                  <strong>Error:</strong> {analysis.error}
                  {analysis.details && (
                    <div className="mt-1 text-[10px] opacity-80">
                      {analysis.details}
                    </div>
                  )}
                </div>
              )}

              {analysis && !analysis.error && (
                <div className="text-xs space-y-3">
                  {analysis.topSkills?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">Top Skills</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.topSkills.map((s, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-emerald-500/20 rounded-full text-[11px]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

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

                  {analysis.rewrittenBullets?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1">
                        Improved Bullet Points
                      </h4>
                      <ul className="list-disc list-inside space-y-1">
                        {analysis.rewrittenBullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.raw && (
                    <details className="mt-2 text-[10px] text-slate-400">
                      <summary>Raw AI response</summary>
                      <pre className="whitespace-pre-wrap mt-1">
                        {analysis.raw}
                      </pre>
                    </details>
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
            {jobsLoading && (
              <span className="text-[11px] text-slate-400">
                Loading jobs...
              </span>
            )}
          </div>

          {jobsError && (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/40 rounded p-2">
              {jobsError}
            </div>
          )}

          {jobs.length === 0 && !jobsLoading && !jobsError && (
            <p className="text-xs text-slate-400">
              No jobs posted yet. Check back later.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map((job) => {
              const group =
                recruiterApps.find((g) => g.jobId === String(job._id)) ||
                { applications: [] };

              return (
                <div
                  key={job._id}
                  className="rounded-xl border border-white/10 bg-slate-950/60 p-4 flex flex-col gap-2"
                >
                  <div>
                    <h3 className="text-sm font-semibold">
                      {job.title}{" "}
                      <span className="text-[11px] text-slate-400">
                        • {job.companyName}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {job.location || "Not specified"}
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-300 line-clamp-3 whitespace-pre-wrap">
                    <strong>Required qualifications:</strong> {job.qualifications}
                  </div>

                  {job.description && (
                    <div className="text-[11px] text-slate-400 line-clamp-3 whitespace-pre-wrap">
                      {job.description}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => handleApplyToJob(job._id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-[11px] font-semibold self-start"
                    >
                      Apply with this resume
                    </button>

                    {currentUser?.role === "recruiter" && (
                      <button
                        onClick={() => toggleSelectJob(job._id)}
                        className="px-3 py-1.5 rounded-lg border border-slate-600 text-[11px]"
                      >
                        {selectedJobForView === job._id ? "Hide Applicants" : "View Applicants"}
                      </button>
                    )}
                  </div>

                  {applyStatus[job._id] && (
                    <p className="text-[11px] mt-1 text-emerald-300">
                      {applyStatus[job._id]}
                    </p>
                  )}

                  {/* If recruiter clicked "View Applicants" show inline list for that job */}
                  {currentUser?.role === "recruiter" &&
                    selectedJobForView === job._id &&
                    !appsLoading &&
                    !appsError && (
                      <div className="space-y-2">
                        {(group.applications || []).length === 0 ? (
                          <div className="text-xs text-slate-400">No applicants yet for this job.</div>
                        ) : (
                          group.applications.map((app, i) => (
                            <div key={i} className="border border-white/5 rounded p-2 bg-slate-950/70">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-semibold">{app.candidateName}</div>
                                  <div className="text-[11px] text-slate-400">{app.candidateEmail}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[11px]">ATS: {typeof app.atsScore !== 'undefined' ? Math.min(100, Math.max(0, Number(app.atsScore))) : '--'}</div>
                                  <div className="text-[11px] text-slate-400">{app.appliedAt ? new Date(app.appliedAt).toLocaleString() : ''}</div>
                                </div>
                              </div>

                              {app.resumeUrl ? (
                                <a
                                  href={app.resumeUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-indigo-300 underline text-xs"
                                >
                                  📄 View Resume (PDF)
                                </a>
                              ) : (
                                <span className="text-red-400 text-xs">
                                  Resume missing
                                </span>
                              )}

                              {app.resumeText && (
                                <details className="mt-2 text-[11px] text-slate-400">
                                  <summary className="cursor-pointer">View extracted resume text</summary>
                                  <div className="mt-1 whitespace-pre-wrap text-[11px] text-slate-300 max-h-40 overflow-y-auto p-2 bg-slate-900/60 rounded">{app.resumeText}</div>
                                </details>
                              )}

                              {app.notes && (
                                <div className="mt-2 text-[11px] text-slate-400">Notes: {app.notes}</div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        </section>

        {/* RECRUITER: All applications (grouped) - visible only to recruiters */}
        {currentUser?.role === "recruiter" && (
          <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">All Applications</h2>
              {appsLoading && <span className="text-[11px] text-slate-400">Loading...</span>}
            </div>

            {appsError && (
              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/40 rounded p-2">{appsError}</div>
            )}

            {!appsLoading && recruiterApps.length === 0 && !appsError && (
              <p className="text-xs text-slate-400">No applications yet.</p>
            )}

            <div className="space-y-4">
              {recruiterApps.map((group) => (
                <div key={group.jobId} className="rounded-xl border border-white/5 p-3 bg-slate-950/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{group.jobTitle}</div>
                      <div className="text-[11px] text-slate-400">{group.jobId}</div>
                    </div>
                    <div className="text-[11px] text-slate-400">{group.applications?.length || 0} applicants</div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {(group.applications || []).map((app, idx) => (
                      <div key={idx} className="border border-white/5 rounded p-2 bg-slate-900/60">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{app.candidateName}</div>
                            <div className="text-[11px] text-slate-400">{app.candidateEmail}</div>
                          </div>
                          <div className="text-[11px]">ATS: {typeof app.atsScore !== 'undefined' ? Math.min(100, Math.max(0, Number(app.atsScore))) : '--'}</div>
                        </div>

                        {app.resumeText && (
                          <details className="mt-2 text-[11px] text-slate-400">
                            <summary className="cursor-pointer">View extracted resume text</summary>
                            <div className="mt-1 whitespace-pre-wrap text-[11px] text-slate-300 max-h-40 overflow-y-auto p-2 bg-slate-900/60 rounded">{app.resumeText}</div>
                          </details>
                        )}

                        {app.resumeUrl && (
                          <div className="mt-2">
                            <a href={app.resumeUrl} target="_blank" rel="noreferrer" className="text-[11px] underline">Open resume file</a>
                          </div>
                        )}

                        {app.notes && <div className="mt-2 text-[11px] text-slate-400">Notes: {app.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-white/10 text-center py-3 text-[11px] text-slate-500">
        © {new Date().getFullYear()} AI Resume Analyzer • Built with React + Express + MongoDB
      </footer>
    </div>
  );
}
