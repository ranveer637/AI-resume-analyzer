// src/RecruiterDashboard.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function RecruiterDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");

  // resume modal state
  const [resumeUrl, setResumeUrl] = useState(null);
  const [resumeFilename, setResumeFilename] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingResume, setLoadingResume] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "";
  const apiUrl = (p) => `${API_BASE}${p.startsWith("/") ? p : "/" + p}`;

  const navigate = useNavigate();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) { navigate("/login"); return; }
      const user = JSON.parse(raw);
      if (user.role !== "recruiter") { navigate("/"); return; }
      setCurrentUser(user);
      loadJobs(user.email);
    } catch {
      navigate("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const loadJobs = async (email) => {
    if (!email) return;
    try {
      setJobsLoading(true);
      setJobsError("");
      const res = await fetch(apiUrl(`/api/recruiter/jobs?recruiterEmail=${encodeURIComponent(email)}`));
      const data = await res.json();
      if (!res.ok) {
        setJobsError(data.error || "Failed to fetch your jobs.");
        return;
      }
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Recruiter jobs error:", err);
      setJobsError("Failed to fetch your jobs.");
    } finally {
      setJobsLoading(false);
    }
  };

  // Open resume in modal (uses the backend endpoint that serves the file inline)
  const openResume = async (appId, filename) => {
    if (!appId) return;
    setLoadingResume(true);
    try {
      // Build resume endpoint URL
      const url = apiUrl(`/api/applications/${appId}/resume`);
      // For safety, open in a new tab if you prefer:
      // window.open(url, "_blank");
      // But we will embed in modal via iframe, and to avoid CORS/download issues we use the URL directly.
      setResumeUrl(url);
      setResumeFilename(filename || "resume.pdf");
      setModalOpen(true);
    } catch (err) {
      console.error("Open resume error:", err);
      alert("Failed to open resume.");
    } finally {
      setLoadingResume(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setResumeUrl(null);
    setResumeFilename("");
  };

  const totalApplications = jobs.reduce((sum, j) => sum + (j.applications?.length || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* header (same as before) */}
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center text-sm font-bold">HR</div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Hiring Manager Dashboard</h1>
              <p className="text-xs text-slate-400">Post roles, review candidates & ATS scores</p>
            </div>
          </div>

          <nav className="flex items-center gap-2 text-xs">
            <Link to="/" className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5">Analyzer</Link>
            {currentUser && <span className="hidden sm:inline text-[11px] text-slate-300 mr-1">{currentUser.company || currentUser.fullName}</span>}
            <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg border border-rose-500/70 text-rose-200 hover:bg-rose-500/10">Logout</button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 md:py-8 space-y-6">
        {/* summary */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Total job posts</p>
            <p className="mt-1 text-2xl font-semibold">{jobs.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">Jobs you have listed</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Total applications</p>
            <p className="mt-1 text-2xl font-semibold">{totalApplications}</p>
            <p className="mt-1 text-[11px] text-slate-500">Across all your roles</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Account</p>
            <p className="mt-1 text-xs text-slate-200">{currentUser?.email || "Loading..."}</p>
            <p className="mt-1 text-[11px] text-slate-500">Role: Recruiter</p>
          </div>
        </section>

        {/* jobs & applications list */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your job posts</h2>
            {jobsLoading && <span className="text-[11px] text-slate-400">Loading jobs...</span>}
          </div>

          {jobsError && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/40 rounded p-2">{jobsError}</div>}

          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {jobs.map((job) => (
              <div key={job._id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-100">{job.title}</h3>
                    <p className="text-[11px] text-slate-400">{job.companyName} • {job.location || "Not specified"}</p>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    <div>{job.applications?.length || 0} applications</div>
                    <div>{new Date(job.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 whitespace-pre-wrap line-clamp-3"><strong>Qualifications:</strong> {job.qualifications}</div>

                {job.applications && job.applications.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {job.applications.map((app) => (
                      <div key={String(app._id)} className="border border-white/10 rounded-lg p-2 bg-slate-900/80 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-[11px]">{app.candidateName}</div>
                          <div className="text-[10px] text-slate-400">{app.candidateEmail}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-[11px] text-slate-400">
                            {app.atsScore != null ? `ATS: ${app.atsScore}/100` : "ATS: N/A"}
                          </div>

                          {app.resumePath ? (
                            <>
                              <button
                                onClick={() => openResume(app._id, app.resumeFilename)}
                                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[11px]"
                              >
                                View Resume
                              </button>
                              <a
                                href={apiUrl(`/api/applications/${app._id}/resume`)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-1 rounded border border-white/10 text-[11px]"
                              >
                                Open in new tab
                              </a>
                            </>
                          ) : (
                            <div className="text-[11px] text-slate-500">No resume</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Resume modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal}></div>
          <div className="relative bg-slate-900 rounded-lg w-full max-w-4xl h-[80vh] overflow-hidden border border-white/10">
            <div className="flex items-center justify-between p-2 border-b border-white/5">
              <div className="text-sm text-slate-200">{resumeFilename}</div>
              <div className="flex items-center gap-2">
                <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 border rounded">Open in new tab</a>
                <button onClick={closeModal} className="text-xs px-2 py-1 border rounded">Close</button>
              </div>
            </div>
            <div className="h-full">
              {loadingResume ? (
                <div className="flex items-center justify-center h-full">Loading resume...</div>
              ) : (
                <iframe src={resumeUrl} title="Resume" className="w-full h-full" />
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-white/10 text-center text-[11px] text-slate-500 py-3">
        © {new Date().getFullYear()} AI Resume Analyzer
      </footer>
    </div>
  );
}
