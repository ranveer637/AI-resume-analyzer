// src/Register.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("candidate");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const API_BASE = import.meta.env.VITE_API_URL || "";
  const apiUrl = (p) => `${API_BASE}${p.startsWith("/") ? p : "/" + p}`;

  const handleRegister = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          role,
          company: role === "recruiter" ? company : "",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(data.error || "Registration failed.");
        setLoading(false);
        return;
      }

      // Save token + user info
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect based on role
      if (data.user.role === "recruiter") {
        navigate("/recruiter-dashboard");
      } else {
        navigate("/");
      }

    } catch (err) {
      setMsg("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900/60 border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-4 text-center">Create Account</h2>

        {msg && (
          <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 p-2 rounded">
            {msg}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-3">
          <div>
            <label className="text-xs text-slate-300">Full Name</label>
            <input
              type="text"
              className="w-full bg-slate-950 border border-slate-600 rounded-lg px-3 py-2 text-sm"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs text-slate-300">Email</label>
            <input
              type="email"
              className="w-full bg-slate-950 border border-slate-600 rounded-lg px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs text-slate-300">Password</label>
            <input
              type="password"
              className="w-full bg-slate-950 border border-slate-600 rounded-lg px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs text-slate-300">Register as</label>
            <select
              className="w-full bg-slate-950 border border-slate-600 rounded-lg px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="candidate">Candidate</option>
              <option value="recruiter">Recruiter / Hiring Manager</option>
            </select>
          </div>

          {role === "recruiter" && (
            <div>
              <label className="text-xs text-slate-300">Company Name</label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-semibold"
          >
            {loading ? "Creating account..." : "Register"}
          </button>

          <p className="text-xs text-slate-400 text-center mt-2">
            Already have an account?{" "}
            <Link to="/login" className="text-indigo-400">
              Login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
