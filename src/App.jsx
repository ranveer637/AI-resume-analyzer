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

  // handle file upload and parse + keyword extraction
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
      const res = await fetch(apiUrl("/api/parse"), { method: "POST", body: formData });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = { text: raw }; }

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

  const analyzeResume = async () => {
    if (!fileRef.current?.files?.[0] && !parsedText) {
      setAnalysis({ error: "Please upload a file or provide resume text." });
      return;
    }

    const formData = new FormData();
    if (fileRef.current?.files?.[0]) formData.append("file", fileRef.current.files[0]);
    else formData.append("text", parsedText);

    try {
      setLoading(true);
      setAnalysis(null);

      const res = await fetch(apiUrl("/api/analyze"), { method: "POST", body: formData });
      const raw = await res.text();

      try {
        const data = JSON.parse(raw);
        setAnalysis(data);
      } catch (e) {
        setAnalysis({ error: "Non-JSON response from server", status: res.status, raw });
      }
    } catch (err) {
      console.error("Analyze failed:", err);
      setAnalysis({ error: err.message || "Failed to analyze resume." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <div className="max-w-4xl w-full bg-white shadow-md rounded-2xl p-8 mt-6">
        <h1 className="text-3xl font-semibold text-indigo-600 mb-3 text-center">AI Resume Analyzer</h1>
        <p className="text-gray-600 text-center mb-6">
          Upload your resume (PDF/DOCX/TXT) to extract keywords and analyze ATS score & suggestions.
        </p>

        <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => { handleFileChange(e); fileRef.current = e.target; }}
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <button
            onClick={analyzeResume}
            disabled={loading}
            className={`px-6 py-2 rounded-lg text-white font-medium ${loading ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}
          >
            {loading ? "Analyzing..." : "Analyze Resume"}
          </button>
        </div>

        <div className="bg-gray-50 border rounded-md p-3 mb-4 text-sm text-gray-700">
          <strong>File:</strong> {fileName || "No file selected"}
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-2">Extracted Resume Text</h2>
          <div className="border rounded-md bg-white p-3 h-48 overflow-y-auto text-sm text-gray-700">
            {parsedText || "No text extracted yet. Upload a file to preview."}
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-2">Detected Keywords</h2>
          {keywords.length === 0 ? (
            <div className="text-sm text-gray-500">No keywords detected yet. Upload a resume to extract keywords.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {keywords.map((k, i) => (
                <span key={i} className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md text-xs">
                  {k}
                </span>
              ))}
            </div>
          )}

          {skillsFound.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              <strong>Skills detected:</strong> {skillsFound.join(", ")}
            </div>
          )}
        </div>

        <div className="mt-6">
          <h2 className="text-lg font-medium text-gray-800 mb-2">AI Analysis</h2>

          {!analysis && <p className="text-gray-500 text-sm">Click “Analyze Resume” to get AI insights.</p>}

          {analysis?.error && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-md text-sm text-red-700">
              <strong>Error:</strong> {analysis.error}
              {analysis.status && <div>Status: {analysis.status}</div>}
              {analysis.raw && (
                <>
                  <div className="mt-2 font-medium">Server returned (raw):</div>
                  <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">{analysis.raw}</pre>
                </>
              )}
            </div>
          )}

          {analysis && !analysis.error && (
            <div className="bg-gray-50 border rounded-md p-4 mt-3 space-y-3 text-sm text-gray-800">
              <div><strong>ATS Score:</strong> {analysis.atsScore ?? "N/A"} / 100</div>

              {analysis.topSkills && (
                <div>
                  <strong>Top Skills:</strong>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {analysis.topSkills.map((skill, index) => (
                      <span key={index} className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md text-xs">{skill}</span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.suggestions && (
                <div>
                  <strong>Suggestions:</strong>
                  <ul className="list-disc list-inside mt-2 text-gray-700">
                    {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              {analysis.rewrittenBullets && (
                <div>
                  <strong>Rewritten Bullets:</strong>
                  <ul className="list-disc list-inside mt-2 text-gray-700">
                    {analysis.rewrittenBullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              )}

              {analysis.keywords && (
                <div>
                  <strong>Keywords (AI):</strong>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {analysis.keywords.map((k, i) => <span key={i} className="bg-green-100 text-green-700 px-2 py-1 rounded-md text-xs">{k}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-center text-gray-400 text-xs mt-10">© {new Date().getFullYear()} AI Resume Analyzer</div>
      </div>
    </div>
  );
}
