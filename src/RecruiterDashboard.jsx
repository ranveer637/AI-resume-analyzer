// src/RecruiterDashboard.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function RecruiterDashboard() {
  const [currentUser, setCurrentUser] = useState(null);

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");

  // New job form
  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [description, setDescription] = useState("");
  const [creatingJob, setCreatingJob] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  const navigate = useNavigate();

  const API_BASE = import.meta.env.VITE_API_URL || "";
  const apiUrl = (p) => `${API_BASE}${p.startsWith("/") ? p : "/" + p}`;

  // Protect route + load recruiter jobs
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) {
        navigate("/login");
        return;
      }
      const user = JSON.parse(raw);
      if (user.role !== "recruiter") {
        navigate("/");
        return;
      }
      setCurrentUser(user);
      setCompanyName(user.company || "");
      loadJobs(user.email);
    } catch {
      navigate("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

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
      const res = await fetch(
        apiUrl(`/api/recruiter/jobs?recruiterEmail=${encodeURIComponent(email)}`)
      );
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

  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    setCreateMsg("");
    setCreatingJob(true);

    try {
      const res = await fetch(apiUrl("/api/recruiter/jobs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          companyName: companyName || currentUser.company || "",
          location,
          qualifications,
          description,
          recruiterEmail: currentUser.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateMsg(data.error || "Failed to create job.");
        return;
      }

      setCreateMsg("✅ Job posted successfully!");
      setTitle("");
      setLocation("");
      setQualifications("");
      setDescription("");

      // Reload jobs
      await loadJobs(currentUser.email);
    } catch (err) {
      console.error("Create job error:", err);
      setCreateMsg("Failed to create job. Please try again.");
    } finally {
      setCreatingJob(false);
    }
  };

  const totalApplications = jobs.reduce(
    (sum, j) => sum + (j.applications?.length || 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#4f46e5_0,_transparent_55%),radial-gradient(circle_at_bottom,_#0ea5e9_0,_transparent_55%)] opacity-30" />
      </div>

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center text-sm font-bold">
              HR
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Hiring Manager Dashboard
              </h1>
              <p className="text-xs text-slate-400">
                Post roles, review candidates & ATS scores
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2 text-xs">
            <Link
              to="/"
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
            >
              Analyzer
            </Link>
            {currentUser && (
              <span className="hidden sm:inline text-[11px] text-slate-300 mr-1">
                {currentUser.company
                  ? `${currentUser.company}`
                  : currentUser.fullName}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg border border-rose-500/70 text-rose-200 hover:bg-rose-500/10"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 md:py-8 space-y-6">
        {/* Summary cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Total job posts</p>
            <p className="mt-1 text-2xl font-semibold">{jobs.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Jobs you have listed
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Total applications</p>
            <p className="mt-1 text-2xl font-semibold">{totalApplications}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Across all your roles
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Account</p>
            <p className="mt-1 text-xs text-slate-200">
              {currentUser?.email || "Loading..."}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Role: Recruiter / Hiring manager
            </p>
          </div>
        </section>

        {/* New job form + job list */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* New job form */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-3">
            <h2 className="text-sm font-semibold mb-1">Post a new job</h2>

            {createMsg && (
              <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/40 rounded p-2">
                {createMsg}
              </div>
            )}

            <form onSubmit={handleCreateJob} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 text-slate-300">Job title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. Senior Backend Engineer"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-300">
                  Company name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. TechSolutions Global"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-300">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Remote / City, Country"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-300">
                  Required qualifications
                </label>
                <textarea
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  required
                  rows={4}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Required skills, experience, education..."
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-300">
                  Job description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="What will the candidate work on?"
                />
              </div>

              <button
                type="submit"
                disabled={creatingJob}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-semibold"
              >
                {creatingJob ? "Posting..." : "Post job"}
              </button>
            </form>
          </div>

          {/* Your jobs & applications */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Your job posts</h2>
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
                You haven't posted any jobs yet.
              </p>
            )}

            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {jobs.map((job) => (
                <div
                  key={job._id}
                  className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-100">
                        {job.title}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {job.companyName} •{" "}
                        {job.location || "Location not specified"}
                      </p>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      <div>
                        {job.applications?.length || 0} applications
                      </div>
                      <div>
                        {new Date(job.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-300 whitespace-pre-wrap line-clamp-3">
                    <strong>Qualifications:</strong> {job.qualifications}
                  </div>

                  {job.description && (
                    <div className="text-[11px] text-slate-400 whitespace-pre-wrap line-clamp-3">
                      {job.description}
                    </div>
                  )}

                  {/* Applications */}
                  {job.applications && job.applications.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-indigo-300">
                        View applications ({job.applications.length})
                      </summary>
                      <div className="mt-2 space-y-1">
                        {job.applications.map((app, idx) => (
                         <div
  key={idx}
  className="border border-white/10 rounded-lg px-2 py-2 bg-slate-900/80 space-y-1"
>
  <div className="flex items-center justify-between">
    <div>
      <div className="font-semibold text-[11px]">
        {app.candidateName || "Unnamed Candidate"}
      </div>
      <div className="text-[10px] text-slate-400">
        {app.candidateEmail}
      </div>
    </div>

    <div className="text-right text-[10px] text-slate-400">
      <div>
        {app.atsScore != null
          ? `ATS: ${app.atsScore}/100`
          : "ATS: N/A"}
      </div>
      <div>
        {app.appliedAt
          ? new Date(app.appliedAt).toLocaleDateString()
          : ""}
      </div>
    </div>
  </div>

  {/* ✅ RESUME LINK */}
  {app.resumeUrl ? (
    <a
      href={app.resumeUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-block text-[10px] text-indigo-300 underline"
    >
      📄 View Resume (PDF)
    </a>
  ) : (
    <div className="text-[10px] text-red-400">
      ❌ Resume not available
    </div>
  )}

  {/* Optional notes */}
  {app.notes && (
    <div className="text-[10px] text-slate-300">
      {app.notes}
    </div>
  )}
</div>

                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-[11px]">
                                  {app.candidateName}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {app.candidateEmail}
                                </div>
                              </div>
                              <div className="text-right text-[10px] text-slate-400">
                                <div>
                                  {app.atsScore != null
                                    ? `ATS: ${app.atsScore}/100`
                                    : "ATS: N/A"}
                                </div>
                                <div>
                                  {app.createdAt
                                    ? new Date(
                                        app.createdAt
                                      ).toLocaleDateString()
                                    : ""}
                                </div>
                              </div>
                            </div>
                            {app.notes && (
                              <div className="mt-1 text-[10px] text-slate-300">
                                {app.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 text-center text-[11px] text-slate-500 py-3">
        © {new Date().getFullYear()} AI Resume Analyzer • Hiring Manager View
      </footer>
    </div>
  );
}
