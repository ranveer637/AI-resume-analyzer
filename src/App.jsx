// src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function App() {
  /* -------------------------------------------------- */
  /* STATE */
  /* -------------------------------------------------- */
  const [fileName, setFileName] = useState("");
  const [parsedText, setParsedText] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);

  // jobs
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");
  const [applyStatus, setApplyStatus] = useState({});

  // recruiter applications
  const [recruiterApps, setRecruiterApps] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState("");

  const fileRef = useRef(null);
  const navigate = useNavigate();

  const API_BASE = import.meta.env.VITE_API_URL || "";
  const apiUrl = (p) => `${API_BASE}${p.startsWith("/") ? p : "/" + p}`;

  /* -------------------------------------------------- */
  /* LOAD USER */
  /* -------------------------------------------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setCurrentUser(JSON.parse(raw));
    } catch {
      setCurrentUser(null);
    }
  }, []);

  /* -------------------------------------------------- */
  /* LOAD JOBS */
  /* -------------------------------------------------- */
  useEffect(() => {
    const loadJobs = async () => {
      try {
        setJobsLoading(true);
        const res = await fetch(apiUrl("/api/jobs"));
        const data = await res.json();
        if (!res.ok) throw new Error();
        setJobs(data || []);
      } catch {
        setJobsError("Failed to fetch jobs.");
      } finally {
        setJobsLoading(false);
      }
    };
    loadJobs();
  }, []);

  /* -------------------------------------------------- */
  /* LOAD RECRUITER APPLICATIONS */
  /* -------------------------------------------------- */
  useEffect(() => {
    if (!currentUser || currentUser.role !== "recruiter") return;

    const loadApps = async () => {
      try {
        setAppsLoading(true);
        const res = await fetch(
          apiUrl(
            `/api/recruiter/applications?recruiterEmail=${currentUser.email}`
          )
        );
        const data = await res.json();
        if (!res.ok) throw new Error();
        setRecruiterApps(data || []);
      } catch {
        setAppsError("Failed to fetch applications.");
      } finally {
        setAppsLoading(false);
      }
    };

    loadApps();
  }, [currentUser]);

  /* -------------------------------------------------- */
  /* LOGOUT */
  /* -------------------------------------------------- */
  const handleLogout = () => {
    localStorage.removeItem("user");
    setCurrentUser(null);
    navigate("/login");
  };

  /* -------------------------------------------------- */
  /* PARSE RESUME */
  /* -------------------------------------------------- */
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setParsedText("");
    setKeywords([]);
    setAnalysis(null);

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(apiUrl("/api/parse"), {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setParsedText(data.text || "");
      setKeywords(data.keywords || []);
    } catch {
      setParsedText("Failed to parse resume.");
    } finally {
      setLoading(false);
    }

    analyzeResume();
  };

  /* -------------------------------------------------- */
  /* ANALYZE */
  /* -------------------------------------------------- */
  const analyzeResume = async () => {
    try {
      const res = await fetch(apiUrl("/api/analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: parsedText }),
      });
      const data = await res.json();
      setAnalysis(data);
    } catch {
      setAnalysis(null);
    }
  };

  const atsScore = analysis?.atsScore ?? "--";

  /* -------------------------------------------------- */
  /* APPLY TO JOB */
  /* -------------------------------------------------- */
  const handleApply = async (jobId) => {
    if (!currentUser || currentUser.role !== "candidate") {
      alert("Login as candidate");
      return;
    }

    if (!parsedText) {
      alert("Upload resume first");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/jobs/${jobId}/apply`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: currentUser.fullName,
          candidateEmail: currentUser.email,
          atsScore,
          resumeText: parsedText,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error();

      setApplyStatus((p) => ({ ...p, [jobId]: "✅ Applied successfully" }));
    } catch {
      setApplyStatus((p) => ({ ...p, [jobId]: "❌ Failed to apply" }));
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------- */
  /* UI */
  /* -------------------------------------------------- */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* HEADER */}
      <header className="border-b border-white/10 p-4 flex justify-between">
        <h1 className="font-bold">AI Resume Analyzer</h1>
        <nav className="flex gap-2 text-xs">
          {!currentUser && (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
          {currentUser && (
            <>
              <span>{currentUser.fullName}</span>
              <button onClick={handleLogout}>Logout</button>
            </>
          )}
        </nav>
      </header>

      {/* MAIN */}
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* UPLOAD */}
        <div className="bg-slate-900 p-4 rounded">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileChange}
          />
          <p className="text-xs mt-1">{fileName}</p>
        </div>

        {/* KEYWORDS */}
        <div className="bg-slate-900 p-4 rounded">
          <h3>Detected Keywords</h3>
          <div className="flex flex-wrap gap-2">
            {keywords.map((k, i) => (
              <span key={i} className="text-xs bg-indigo-500/20 px-2 py-1">
                {k}
              </span>
            ))}
          </div>
        </div>

        {/* JOBS */}
        <section>
          <h2>Open Positions</h2>
          {jobs.map((job) => (
            <div key={job._id} className="bg-slate-900 p-4 rounded mb-3">
              <h3>{job.title}</h3>
              <p className="text-xs">{job.companyName}</p>
              <button
                onClick={() => handleApply(job._id)}
                className="text-xs mt-2 bg-indigo-500 px-3 py-1 rounded"
              >
                Apply
              </button>
              {applyStatus[job._id] && (
                <p className="text-xs mt-1">{applyStatus[job._id]}</p>
              )}
            </div>
          ))}
        </section>

        {/* RECRUITER APPLICATIONS */}
        {currentUser?.role === "recruiter" && (
          <section>
            <h2>Applications</h2>
            {recruiterApps.map((group) => (
              <div key={group.jobId} className="bg-slate-900 p-4 mb-4 rounded">
                <h3>{group.jobTitle}</h3>

                {group.applications.map((app, i) => (
                  <div key={i} className="border-t border-white/10 mt-2 pt-2">
                    <div>{app.candidateName}</div>
                    <div className="text-xs">{app.candidateEmail}</div>
                    <div className="text-xs">ATS: {app.atsScore}/100</div>

                    {app.resumeUrl && (
                      <a
                        href={app.resumeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline text-indigo-400"
                      >
                        📄 View Resume PDF
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

