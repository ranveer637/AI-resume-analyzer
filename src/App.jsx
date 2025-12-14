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

  // Jobs
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");
  const [applyStatus, setApplyStatus] = useState({});

  // Recruiter
  const [recruiterApps, setRecruiterApps] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState("");
  const [selectedJobForView, setSelectedJobForView] = useState(null);

  const fileRef = useRef(null);
  const navigate = useNavigate();

  const API_BASE = import.meta.env.VITE_API_URL || "";
  const apiUrl = (p) => `${API_BASE}${p}`;

  // -------------------------------
  // Load user
  // -------------------------------
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) setCurrentUser(JSON.parse(raw));
  }, []);

  // -------------------------------
  // Load jobs
  // -------------------------------
  useEffect(() => {
    const loadJobs = async () => {
      try {
        setJobsLoading(true);
        const res = await fetch(apiUrl("/api/jobs"));
        const data = await res.json();
        if (!res.ok) throw new Error();
        setJobs(data);
      } catch {
        setJobsError("Failed to fetch jobs.");
      } finally {
        setJobsLoading(false);
      }
    };
    loadJobs();
  }, []);

  // -------------------------------
  // Load recruiter applications
  // -------------------------------
  useEffect(() => {
    if (!currentUser || currentUser.role !== "recruiter") return;

    const loadApps = async () => {
      try {
        setAppsLoading(true);
        const res = await fetch(apiUrl("/api/recruiter/applications"));
        const data = await res.json();
        if (!res.ok) throw new Error();
        setRecruiterApps(data);
      } catch {
        setAppsError("Failed to fetch applications.");
      } finally {
        setAppsLoading(false);
      }
    };
    loadApps();
  }, [currentUser]);

  // -------------------------------
  // Parse resume
  // -------------------------------
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setParsedText("");
    setKeywords([]);
    setSkillsFound([]);
    setTopTokens([]);
    setAnalysis(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      setLoading(true);
      const res = await fetch(apiUrl("/api/parse"), {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      setParsedText(data.text || "");
      setKeywords(data.keywords || []);
      setSkillsFound(data.skillsFound || []);
      setTopTokens(data.topTokens || []);
    } catch {
      setParsedText("Failed to parse resume.");
    } finally {
      setLoading(false);
    }

    analyzeResume();
  };

  // -------------------------------
  // Analyze resume
  // -------------------------------
  const analyzeResume = async () => {
    if (!parsedText && !fileRef.current?.files?.[0]) return;

    const fd = new FormData();
    if (fileRef.current?.files?.[0]) {
      fd.append("file", fileRef.current.files[0]);
    } else {
      fd.append("text", parsedText);
    }

    try {
      setLoading(true);
      const res = await fetch(apiUrl("/api/analyze"), {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      setAnalysis(data);
    } catch {
      setAnalysis({ error: "AI analysis failed." });
    } finally {
      setLoading(false);
    }
  };

  const atsScore =
    analysis?.atsScore !== undefined ? Number(analysis.atsScore) : null;

  // -------------------------------
  // APPLY TO JOB (🔥 FIXED 🔥)
  // -------------------------------
  const handleApplyToJob = async (jobId) => {
    if (!currentUser || currentUser.role !== "candidate") {
      alert("Login as candidate first");
      return;
    }

    if (!parsedText || !parsedText.trim()) {
      alert("Upload resume first");
      return;
    }

    try {
      setLoading(true);

      const body = {
        candidateName: currentUser.fullName,
        candidateEmail: currentUser.email,
        atsScore: atsScore,
        resumeText: parsedText, // 🔥 REQUIRED
      };

      const res = await fetch(apiUrl(`/api/jobs/${jobId}/apply`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setApplyStatus((p) => ({ ...p, [jobId]: "✅ Applied successfully" }));
    } catch {
      setApplyStatus((p) => ({ ...p, [jobId]: "❌ Apply failed" }));
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------
  // UI
  // -------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <h1 className="text-xl font-bold mb-4">AI Resume Analyzer</h1>

      {/* Upload */}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={handleFileChange}
      />
      <p className="text-xs mt-1">{fileName}</p>

      {/* Keywords */}
      <div className="mt-4">
        <h3 className="font-semibold">Detected Keywords</h3>
        <div className="flex flex-wrap gap-1 mt-1">
          {keywords.map((k, i) => (
            <span key={i} className="text-xs bg-indigo-500/20 px-2 py-1 rounded">
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Jobs */}
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Open Positions</h2>

        {jobs.map((job) => (
          <div key={job._id} className="border p-3 rounded mb-2">
            <div className="font-semibold">
              {job.title} • {job.companyName}
            </div>
            <button
              onClick={() => handleApplyToJob(job._id)}
              className="mt-2 bg-indigo-500 px-3 py-1 rounded text-xs"
            >
              Apply
            </button>
            {applyStatus[job._id] && (
              <p className="text-xs mt-1">{applyStatus[job._id]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


