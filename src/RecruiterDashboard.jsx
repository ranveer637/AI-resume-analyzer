// src/RecruiterDashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

/**
 * Recruiter Dashboard
 * - Uses authFetch which reads token from localStorage ("token")
 * - Displays recruiter's jobs (auth required)
 * - Post a new job
 * - View each application's resume inline by fetching the file as a blob (auth needed)
 */

// API base (set VITE_API_URL in environment if your API is on another host)
const API_BASE = import.meta.env.VITE_API_URL || "";
const apiUrl = (p) => `${API_BASE}${p.startsWith("/") ? p : "/" + p}`;

function getAuth() {
  try {
    const token = localStorage.getItem("token");
    const raw = localStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    return { token, user };
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

export default function RecruiterDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsError, setJobsError] = useState("");

  // new job form
  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  // resume modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFilename, setModalFilename] = useState("");
  const [modalBlobUrl, setModalBlobUrl] = useState("");
  const [loadingResume, setLoadingResume] = useState(false);

  const blobUrlRef = useRef(null);

  useEffect(() => {
    // check auth
    const r = getAuth();
    if (!r.user || !r.token) {
      navigate("/login");
      return;
    }
    setUser(r.user);
    // prefer recruiter company name default
    if (r.user.company) setCompanyName(r.user.company);
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load jobs posted by this recruiter
  const loadJobs = async () => {
    setLoadingJobs(true);
    setJobsError("");
    try {
      const res = await authFetch(apiUrl("/api/recruiter/jobs"));
      const data = await res.json();
      if (!res.ok) {
        setJobsError(data.error || "Failed to load jobs");
        setJobs([]);
        return;
      }
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("loadJobs error:", err);
      setJobsError("Network error while loading jobs");
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleCreateJob = async (e) => {
    e?.preventDefault();
    setCreateMsg("");
    if (!title || !companyName || !qualifications) {
      setCreateMsg("Title, company and qualifications are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await authFetch(apiUrl("/api/recruiter/jobs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, companyName, location, qualifications, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateMsg(data.error || "Failed to create job");
        return;
      }
      setCreateMsg("✅ Job posted");
      setTitle("");
      setLocation("");
      setQualifications("");
      setDescription("");
      // reload jobs
      await loadJobs();
    } catch (err) {
      console.error("create job error:", err);
      setCreateMsg("Network error while creating job");
    } finally {
      setCreating(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  // fetch resume as blob, create blob URL and show modal
  const openResume = async (appId, filename) => {
    if (!appId) return alert("Missing application id");
    setLoadingResume(true);
    try {
      const res = await authFetch(apiUrl(`/api/applications/${appId}/resume`));
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to fetch resume");
      }
      const arrayBuffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "application/pdf";
      const blob = new Blob([arrayBuffer], { type: contentType });
      // revoke previous blob if any
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      setModalBlobUrl(blobUrl);
      setModalFilename(filename || "resume.pdf");
      setModalOpen(true);
    } catch (err) {
      console.error("openResume error:", err);
      alert("Failed to load resume: " + (err?.message || ""));
    } finally {
      setLoadingResume(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalFilename("");
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setModalBlobUrl("");
  };

  const openInNewTab = () => {
    if (!modalBlobUrl) return;
    window.open(modalBlobUrl, "_blank");
  };

  const downloadResume = () => {
    if (!modalBlobUrl) return;
    const a = document.createElement("a");
    a.href = modalBlobUrl;
    a.download = modalFilename || "resume.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* header */}
      <header className="border-b border-white/10 bg-slate-950/70">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center font-bold">HR</div>
            <div>
              <h1 className="text-lg font-semibold">Recruiter Dashboard</h1>
              <p className="text-xs text-slate-400">Post jobs • Review applicants</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/" className="px-3 py-1 rounded-lg border border-white/10 text-xs">Analyzer</Link>
            <div className="text-xs text-slate-300">{user?.company || user?.fullName}</div>
            <button onClick={logout} className="px-3 py-1 rounded-lg border border-rose-500/70 text-rose-200">Logout</button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
        {/* top summary + form */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-slate-900/70 p-4 border border-white/10">
            <div className="text-xs text-slate-400">Your Jobs</div>
            <div className="text-2xl font-semibold mt-1">{jobs.length}</div>
            <div className="text-xs text-slate-500 mt-1">Jobs posted by you</div>
          </div>

          <div className="rounded-2xl bg-slate-900/70 p-4 border border-white/10">
            <div className="text-xs text-slate-400">Total applications</div>
            <div className="text-2xl font-semibold mt-1">
              {jobs.reduce((s, j) => s + (j.applications?.length || 0), 0)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Across all roles</div>
          </div>

          <div className="rounded-2xl bg-slate-900/70 p-4 border border-white/10">
            <div className="text-xs text-slate-400">Account</div>
            <div className="text-xs mt-1">{user?.email}</div>
            <div className="text-xs text-slate-500 mt-1">Recruiter</div>
          </div>
        </section>

        {/* create job */}
        <section className="rounded-2xl bg-slate-900/80 p-4 border border-white/10">
          <h2 className="text-sm font-semibold mb-2">Post a new job</h2>
          {createMsg && <div className="text-xs mb-2">{createMsg}</div>}
          <form onSubmit={handleCreateJob} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job title" className="bg-slate-950 p-2 rounded border border-slate-700 text-sm" />
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" className="bg-slate-950 p-2 rounded border border-slate-700 text-sm" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (Remote / City)" className="bg-slate-950 p-2 rounded border border-slate-700 text-sm" />
            <input value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="Required qualifications (short)" className="bg-slate-950 p-2 rounded border border-slate-700 text-sm" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} className="md:col-span-2 bg-slate-950 p-2 rounded border border-slate-700 text-sm" />
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" disabled={creating} className="px-3 py-2 rounded bg-emerald-500 hover:bg-emerald-400">
                {creating ? "Posting..." : "Post job"}
              </button>
              <button type="button" onClick={() => { setTitle(""); setLocation(""); setQualifications(""); setDescription(""); }} className="px-3 py-2 rounded border">Clear</button>
            </div>
          </form>
        </section>

        {/* job list with applications */}
        <section className="space-y-4">
          {loadingJobs && <div className="text-xs text-slate-400">Loading jobs...</div>}
          {jobsError && <div className="text-xs text-rose-300">{jobsError}</div>}

          <div className="grid grid-cols-1 gap-4">
            {jobs.map((job) => (
              <div key={job._id} className="rounded-xl bg-slate-950/60 p-4 border border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{job.title}</div>
                    <div className="text-xs text-slate-400">{job.companyName} • {job.location || "Not specified"}</div>
                    <div className="text-xs text-slate-300 mt-2 line-clamp-3">{job.qualifications}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-400">{new Date(job.createdAt).toLocaleDateString()}</div>
                    <div className="text-xs text-slate-400">{(job.applications?.length || 0)} applications</div>
                  </div>
                </div>

                {/* Applications */}
                {job.applications && job.applications.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {job.applications.map((app) => (
                      <div key={String(app._id)} className="flex items-center justify-between gap-3 p-2 bg-slate-900/60 rounded border border-white/5">
                        <div>
                          <div className="font-medium text-sm">{app.candidateName}</div>
                          <div className="text-xs text-slate-400">{app.candidateEmail}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-xs text-slate-400 mr-2">
                            {app.atsScore != null ? `ATS: ${app.atsScore}/100` : "ATS: N/A"}
                          </div>

                          {app.resumePath ? (
                            <>
                              <button
                                onClick={() => openResume(app._id, app.resumeFilename)}
                                className="px-2 py-1 rounded bg-indigo-600 text-xs"
                              >
                                {loadingResume ? "Loading..." : "View Resume"}
                              </button>
                              <button
                                onClick={async () => {
                                  // fetch blob & open in new tab
                                  try {
                                    const res = await authFetch(apiUrl(`/api/applications/${app._id}/resume`));
                                    if (!res.ok) {
                                      const txt = await res.text();
                                      throw new Error(txt || "Failed to fetch");
                                    }
                                    const arrayBuffer = await res.arrayBuffer();
                                    const blob = new Blob([arrayBuffer], { type: res.headers.get("content-type") || "application/pdf" });
                                    const url = URL.createObjectURL(blob);
                                    window.open(url, "_blank");
                                    // revoke after short delay so tab can load
                                    setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
                                  } catch (err) {
                                    console.error("open new tab error:", err);
                                    alert("Could not open resume: " + (err?.message || ""));
                                  }
                                }}
                                className="px-2 py-1 rounded border text-xs"
                              >
                                Open new tab
                              </button>
                            </>
                          ) : (
                            <div className="text-xs text-slate-500">No resume</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-400">No applicants yet</div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* resume modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal}></div>
          <div className="relative max-w-5xl w-full h-[85vh] bg-slate-900 rounded-lg border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-white/5">
              <div className="text-sm font-medium">{modalFilename}</div>
              <div className="flex items-center gap-2">
                <button onClick={downloadResume} className="px-2 py-1 text-xs border rounded">Download</button>
                <button onClick={openInNewTab} className="px-2 py-1 text-xs border rounded">Open</button>
                <button onClick={closeModal} className="px-2 py-1 text-xs border rounded">Close</button>
              </div>
            </div>

            <div className="h-full">
              {loadingResume ? (
                <div className="h-full flex items-center justify-center">Loading...</div>
              ) : (
                <iframe src={modalBlobUrl} title="Resume" className="w-full h-full" />
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-white/10 text-center text-xs text-slate-500 py-3">
        © {new Date().getFullYear()} AI Resume Analyzer
      </footer>
    </div>
  );
}
