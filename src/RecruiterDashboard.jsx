// src/RecruiterDashboard.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";

const MOCK_CANDIDATES = [
  {
    id: 1,
    name: "John Doe",// src/RecruiterDashboard.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const MOCK_CANDIDATES = [
  {
    id: 1,
    name: "John Doe",
    role: "Frontend Developer",
    atsScore: 82,
    skills: ["React", "JavaScript", "Tailwind"],
    status: "Shortlisted",
    appliedOn: "2025-12-01",
  },
  {
    id: 2,
    name: "Sarah Johnson",
    role: "Data Analyst",
    atsScore: 76,
    skills: ["Python", "SQL", "Tableau"],
    status: "Under Review",
    appliedOn: "2025-12-02",
  },
  {
    id: 3,
    name: "Amit Verma",
    role: "Backend Developer",
    atsScore: 69,
    skills: ["Node.js", "Express", "MongoDB"],
    status: "Rejected",
    appliedOn: "2025-11-28",
  },
  {
    id: 4,
    name: "Priya Sharma",
    role: "Full Stack Developer",
    atsScore: 90,
    skills: ["React", "Node.js", "AWS"],
    status: "Interview Scheduled",
    appliedOn: "2025-12-03",
  },
];

export default function RecruiterDashboard() {
  const [minScore, setMinScore] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const navigate = useNavigate();

  // Protect route: only recruiters allowed
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
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const filtered = MOCK_CANDIDATES.filter((c) => {
    if (c.atsScore < minScore) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (
      search &&
      !(
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.role.toLowerCase().includes(search.toLowerCase())
      )
    ) {
      return false;
    }
    return true;
  });

  const avgScore =
    MOCK_CANDIDATES.length > 0
      ? Math.round(
          MOCK_CANDIDATES.reduce((sum, c) => sum + c.atsScore, 0) /
            MOCK_CANDIDATES.length
        )
      : 0;

  const shortlistedCount = MOCK_CANDIDATES.filter(
    (c) => c.status === "Shortlisted"
  ).length;
  const interviewCount = MOCK_CANDIDATES.filter(
    (c) => c.status === "Interview Scheduled"
  ).length;

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
                Review candidates, ATS scores & statuses
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
                Hi, {currentUser.fullName.split(" ")[0]}
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
            <p className="text-xs text-slate-400">Average ATS score</p>
            <p className="mt-1 text-2xl font-semibold">{avgScore}/100</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Across all uploaded candidates
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Shortlisted</p>
            <p className="mt-1 text-2xl font-semibold">{shortlistedCount}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Candidates marked as shortlisted
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Interviews scheduled</p>
            <p className="mt-1 text-2xl font-semibold">{interviewCount}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Upcoming interview candidates
            </p>
          </div>
        </section>

        {/* Filters + table */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs text-slate-300">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by candidate name or role"
                className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300">Min ATS Score</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value) || 0)}
                  className="w-24 rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">All</option>
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Interview Scheduled">
                    Interview Scheduled
                  </option>
                  <option value="Under Review">Under Review</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Candidate list */}
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="text-left py-2 pr-4">Candidate</th>
                  <th className="text-left py-2 pr-4">Role</th>
                  <th className="text-left py-2 pr-4">ATS Score</th>
                  <th className="text-left py-2 pr-4">Skills</th>
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-left py-2">Applied</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 text-center text-slate-500"
                    >
                      No candidates match the current filters.
                    </td>
                  </tr>
                )}

                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-white/5 hover:bg-slate-800/60"
                  >
                    <td className="py-2 pr-4">
                      <div className="font-semibold text-slate-100">
                        {c.name}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-slate-200">{c.role}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] ${
                          c.atsScore >= 80
                            ? "bg-emerald-500/20 text-emerald-200"
                            : c.atsScore >= 60
                            ? "bg-yellow-500/20 text-yellow-200"
                            : "bg-rose-500/20 text-rose-200"
                        }`}
                      >
                        {c.atsScore}
                      </span>
                    </td>
                    <td className="py-2 pr-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {c.skills.map((s, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-1 rounded-full bg-slate-800 text-[11px]">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 text-slate-300">{c.appliedOn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 text-center text-[11px] text-slate-500 py-3">
        © {new Date().getFullYear()} AI Resume Analyzer • Hiring Manager View
      </footer>
    </div>
  );
}

    role: "Frontend Developer",
    atsScore: 82,
    skills: ["React", "JavaScript", "Tailwind"],
    status: "Shortlisted",
    appliedOn: "2025-12-01",
  },
  {
    id: 2,
    name: "Sarah Johnson",
    role: "Data Analyst",
    atsScore: 76,
    skills: ["Python", "SQL", "Tableau"],
    status: "Under Review",
    appliedOn: "2025-12-02",
  },
  {
    id: 3,
    name: "Amit Verma",
    role: "Backend Developer",
    atsScore: 69,
    skills: ["Node.js", "Express", "MongoDB"],
    status: "Rejected",
    appliedOn: "2025-11-28",
  },
  {
    id: 4,
    name: "Priya Sharma",
    role: "Full Stack Developer",
    atsScore: 90,
    skills: ["React", "Node.js", "AWS"],
    status: "Interview Scheduled",
    appliedOn: "2025-12-03",
  },
];

export default function RecruiterDashboard() {
  const [minScore, setMinScore] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = MOCK_CANDIDATES.filter((c) => {
    if (c.atsScore < minScore) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (
      search &&
      !(
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.role.toLowerCase().includes(search.toLowerCase())
      )
    ) {
      return false;
    }
    return true;
  });

  const avgScore =
    MOCK_CANDIDATES.length > 0
      ? Math.round(
          MOCK_CANDIDATES.reduce((sum, c) => sum + c.atsScore, 0) /
            MOCK_CANDIDATES.length
        )
      : 0;

  const shortlistedCount = MOCK_CANDIDATES.filter(
    (c) => c.status === "Shortlisted"
  ).length;
  const interviewCount = MOCK_CANDIDATES.filter(
    (c) => c.status === "Interview Scheduled"
  ).length;

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
                Review candidates, ATS scores & statuses
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
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-lg border border-slate-600 hover:bg-white/5"
            >
              Logout
            </Link>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 md:py-8 space-y-6">
        {/* Summary cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Average ATS score</p>
            <p className="mt-1 text-2xl font-semibold">{avgScore}/100</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Across all uploaded candidates
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Shortlisted</p>
            <p className="mt-1 text-2xl font-semibold">{shortlistedCount}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Candidates marked as shortlisted
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">Interviews scheduled</p>
            <p className="mt-1 text-2xl font-semibold">{interviewCount}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Upcoming interview candidates
            </p>
          </div>
        </section>

        {/* Filters + table */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs text-slate-300">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by candidate name or role"
                className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300">
                  Min ATS Score
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value) || 0)}
                  className="w-24 rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">All</option>
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Interview Scheduled">
                    Interview Scheduled
                  </option>
                  <option value="Under Review">Under Review</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Candidate list */}
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="text-left py-2 pr-4">Candidate</th>
                  <th className="text-left py-2 pr-4">Role</th>
                  <th className="text-left py-2 pr-4">ATS Score</th>
                  <th className="text-left py-2 pr-4">Skills</th>
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-left py-2">Applied</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 text-center text-slate-500"
                    >
                      No candidates match the current filters.
                    </td>
                  </tr>
                )}

                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-white/5 hover:bg-slate-800/60"
                  >
                    <td className="py-2 pr-4">
                      <div className="font-semibold text-slate-100">
                        {c.name}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-slate-200">{c.role}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] ${
                          c.atsScore >= 80
                            ? "bg-emerald-500/20 text-emerald-200"
                            : c.atsScore >= 60
                            ? "bg-yellow-500/20 text-yellow-200"
                            : "bg-rose-500/20 text-rose-200"
                        }`}
                      >
                        {c.atsScore}
                      </span>
                    </td>
                    <td className="py-2 pr-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {c.skills.map((s, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-1 rounded-full bg-slate-800 text-[11px]">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 text-slate-300">{c.appliedOn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 text-center text-[11px] text-slate-500 py-3">
        © {new Date().getFullYear()} AI Resume Analyzer • Hiring Manager View
      </footer>
    </div>
  );
}
