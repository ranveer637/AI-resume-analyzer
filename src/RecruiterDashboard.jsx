import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

// RecruiterDashboard.jsx
// - Uses authFetch (reads token from localStorage)
// - Lists jobs posted by the recruiter
// - Allows posting new jobs (includes recruiterEmail automatically)
// - Shows applications per job and lets recruiter view/download resume blobs inline
// - Tailwind classes used to match the rest of the app

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

  // Create job form state
  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  // Resume modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState("");
  const [modalFilename, setModalFilename] = useState("");
  const [loadingResume, setLoadingResume] = useState(false);
  const blobRef = useRef(null);

  useEffect(() => {
    const a = getAuth();
    if (!a.user || !a.token) {
      // redirect to login if not authenticated
      navigate('/login');
      return;
    }
    setUser(a.user);
    // prefill company name if available
    if (a.user.company) setCompanyName(a.user.company);
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadJobs = async () => {
    setLoadingJobs(true);
    setJobsError("");
    try {
      const res = await authFetch(apiUrl('/api/recruiter/jobs'));
      const data = await res.json();
      if (!res.ok) {
        setJobsError(data.error || 'Failed to load jobs');
        setJobs([]);
        return;
      }
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('loadJobs error', err);
      setJobsError('Network error while loading jobs');
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleCreateJob = async (e) => {
    e?.preventDefault();
    setCreateMsg("");
    if (!title || !companyName || !qualifications) {
      setCreateMsg('Title, company and qualifications are required.');
      return;
    }

    // recruiter email from logged user (server should verify from token)
    const recruiterEmail = user?.email || '';
    if (!recruiterEmail) {
      setCreateMsg('Recruiter email not found. Please login again.');
      return;
    }

    setCreating(true);
    try {
      const payload = { title, companyName, location, qualifications, description, recruiterEmail };
      const res = await authFetch(apiUrl('/api/recruiter/jobs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateMsg(data.error || 'Failed to create job');
        return;
      }

      setCreateMsg('✅ Job posted');
      setTitle(''); setLocation(''); setQualifications(''); setDescription('');
      // reload
      await loadJobs();
    } catch (err) {
      console.error('create job error', err);
      setCreateMsg('Network error while creating job');
    } finally {
      setCreating(false);
    }
  };

  // Open resume blob inline
  const openResume = async (applicationId, filename) => {
    if (!applicationId) return alert('Missing application id');
    setLoadingResume(true);
    try {
      const res = await authFetch(apiUrl(`/api/applications/${applicationId}/resume`));
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to fetch resume');
      }
      const contentType = res.headers.get('content-type') || 'application/pdf';
      const buffer = await res.arrayBuffer();
      const blob = new Blob([buffer], { type: contentType });
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
      const url = URL.createObjectURL(blob);
      blobRef.current = url;
      setModalUrl(url);
      setModalFilename(filename || 'resume.pdf');
      setModalOpen(true);
    } catch (err) {
      console.error('openResume error', err);
      alert('Failed to load resume: ' + (err?.message || ''));
    } finally {
      setLoadingResume(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalFilename('');
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
    setModalUrl('');
  };

  const downloadModal = () => {
    if (!modalUrl) return;
    const a = document.createElement('a');
    a.href = modalUrl;
    a.download = modalFilename || 'resume.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-white/10 bg-slate-950/70">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center font-bold">HR</div>
            <div>
              <h1 className="text-lg font-semibold">Recruiter Dashboard</h1>
              <p className="text-xs text-slate-400">Manage jobs & review applicants</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/" className="px-3 py-1 rounded-lg border border-white/10 text-xs">Analyzer</Link>
            <div className="text-xs text-slate-300">{user?.company || user?.fullName}</div>
            <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/login'; }} className="px-3 py-1 rounded-lg border border-rose-500/70 text-rose-200">Logout</button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-slate-900/70 p-4 border border-white/10">
            <div className="text-xs text-slate-400">Your Jobs</div>
            <div className="text-2xl font-semibold mt-1">{jobs.length}</div>
            <div className="text-xs text-slate-500 mt-1">Jobs posted by you</div>
          </div>

          <div className="rounded-2xl bg-slate-900/70 p-4 border border-white/10">
            <div className="text-xs text-slate-400">Total applications</div>
            <div className="text-2xl font-semibold mt-1">{jobs.reduce((s, j) => s + (j.applications?.length || 0), 0)}</div>
            <div className="text-xs text-slate-500 mt-1">Across all roles</div>
          </div>

          <div className="rounded-2xl bg-slate-900/70 p-4 border border-white/10">
            <div className="text-xs text-slate-400">Account</div>
            <div className="text-xs mt-1">{user?.email}</div>
            <div className="text-xs text-slate-500 mt-1">Recruiter</div>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900/70 p-4 border border-white/10">
          <h2 className="text-sm font-semibold mb-2">Post a new job</h2>
          {createMsg && <div className="text-xs mb-2">{createMsg}</div>}
          <form onSubmit={handleCreateJob} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job title" className="bg-slate-950 p-2 rounded border border-slate-700 text-sm" />
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" className="bg-slate-950 p-2 rounded border border-slate-700 text-sm" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (Remote / City)" className="bg-slate-950 p-2 rounded border border-slate-700 text-sm" />
            <input value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="Required qualifications (short)" className="bg-slate-950 p-2 rounded border border-slate-700 text-sm" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} className="md:col-span-2 bg-slate-950 p-2 rounded border border-slate-700 text-sm" />
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" disabled={creating} className="px-3 py-2 rounded bg-emerald-500 hover:bg-emerald-400">{creating ? 'Posting...' : 'Post job'}</button>
              <button type="button" onClick={() => { setTitle(''); setLocation(''); setQualifications(''); setDescription(''); }} className="px-3 py-2 rounded border">Clear</button>
            </div>
          </form>
        </section>

        <section className="space-y-4">
          {loadingJobs && <div className="text-xs text-slate-400">Loading jobs...</div>}
          {jobsError && <div className="text-xs text-rose-300">{jobsError}</div>}

          <div className="grid grid-cols-1 gap-4">
            {jobs.map((job) => (
              <div key={job._id} className="rounded-xl bg-slate-950/60 p-4 border border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{job.title}</div>
                    <div className="text-xs text-slate-400">{job.companyName} • {job.location || 'Not specified'}</div>
                    <div className="text-xs text-slate-300 mt-2 line-clamp-3">{job.qualifications}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-400">{new Date(job.createdAt).toLocaleDateString()}</div>
                    <div className="text-xs text-slate-400">{(job.applications?.length || 0)} applications</div>
                  </div>
                </div>

                {job.applications && job.applications.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {job.applications.map((app) => (
                      <div key={String(app._id)} className="flex items-center justify-between gap-3 p-2 bg-slate-900/60 rounded border border-white/5">
                        <div>
                          <div className="font-medium text-sm">{app.candidateName}</div>
                          <div className="text-xs text-slate-400">{app.candidateEmail}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-xs text-slate-400 mr-2">{app.atsScore != null ? `ATS: ${app.atsScore}/100` : 'ATS: N/A'}</div>

                          {app.resumePath ? (
                            <>
                              <button onClick={() => openResume(app._id, app.resumeFilename)} className="px-2 py-1 rounded bg-indigo-600 text-xs">{loadingResume ? 'Loading...' : 'View Resume'}</button>
                              <button onClick={async () => {
                                try {
                                  const res = await authFetch(apiUrl(`/api/applications/${app._id}/resume`));
                                  if (!res.ok) {
                                    const txt = await res.text();
                                    throw new Error(txt || 'Failed to fetch');
                                  }
                                  const buf = await res.arrayBuffer();
                                  const blob = new Blob([buf], { type: res.headers.get('content-type') || 'application/pdf' });
                                  const url = URL.createObjectURL(blob);
                                  window.open(url, '_blank');
                                  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
                                } catch (err) {
                                  console.error('open new tab error:', err);
                                  alert('Could not open resume: ' + (err?.message || ''));
                                }
                              }} className="px-2 py-1 rounded border text-xs">Open new tab</button>
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
                <button onClick={downloadModal} className="px-2 py-1 text-xs border rounded">Download</button>
                <button onClick={() => window.open(modalUrl, '_blank')} className="px-2 py-1 text-xs border rounded">Open</button>
                <button onClick={closeModal} className="px-2 py-1 text-xs border rounded">Close</button>
              </div>
            </div>

            <div className="h-full">
              {loadingResume ? (
                <div className="h-full flex items-center justify-center">Loading...</div>
              ) : (
                <iframe src={modalUrl} title="Resume" className="w-full h-full" />
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-white/10 text-center text-xs text-slate-500 py-3">© {new Date().getFullYear()} AI Resume Analyzer</footer>
    </div>
  );
}
