// server.js
// Express backend for AI Resume Analyzer + Job Board

import express from "express";
import multer from "multer";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import cors from "cors";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// -------- Rate limiting --------
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
  })
);

// -------- MongoDB --------
mongoose
  .connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || "ai-resume-analyzer",
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// -------- Schemas --------
const ApplicationSchema = new mongoose.Schema(
  {
    candidateName: String,
    candidateEmail: String,
    atsScore: Number,
    notes: String,
    resumeUrl: String,
    resumeText: String,
    appliedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const JobSchema = new mongoose.Schema({
  title: String,
  companyName: String,
  location: String,
  qualifications: String,
  description: String,
  recruiterEmail: String,
  applications: [ApplicationSchema],
  createdAt: { type: Date, default: Date.now },
});

const Job = mongoose.model("Job", JobSchema);

// =====================================================
//  UPLOAD DIRECTORIES (mkdirp REMOVED)
// =====================================================
const UPLOADS_DIR = path.join(__dirname, "uploads");
const RESUMES_DIR = path.join(UPLOADS_DIR, "resumes");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(RESUMES_DIR)) {
  fs.mkdirSync(RESUMES_DIR, { recursive: true });
}

const upload = multer({ dest: UPLOADS_DIR });

// Serve resumes
app.use("/resumes", express.static(RESUMES_DIR));

// =====================================================
//  HELPERS
// =====================================================
function safeUnlink(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

function readFileUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

async function safeParsePdfBuffer(buffer) {
  try {
    const data = await pdf(buffer);
    return data?.text || "";
  } catch {
    return "";
  }
}

function extractJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {}
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s !== -1 && e !== -1 && e > s) {
    try {
      return JSON.parse(text.slice(s, e + 1));
    } catch {}
  }
  return null;
}

// =====================================================
//  ATS FALLBACK
// =====================================================
function estimateAtsScoreFromText(text, kw) {
  let score = 40;
  const len = (text || "").split(/\s+/).length;
  if (len > 150) score += 10;
  if (len > 300) score += 10;
  if ((kw?.keywords || []).length > 10) score += 20;
  return Math.min(95, Math.max(30, score));
}

// =====================================================
//  ANALYZE ROUTE (YOUR LOGIC – UNCHANGED)
// =====================================================
app.post("/api/analyze", upload.single("file"), async (req, res) => {
  let filePath;
  try {
    let text = "";

    if (req.file) {
      filePath = req.file.path;
      const name = req.file.originalname.toLowerCase();

      if (name.endsWith(".pdf")) {
        text = await safeParsePdfBuffer(fs.readFileSync(filePath));
      } else if (name.endsWith(".docx")) {
        text = (await mammoth.extractRawText({ path: filePath })).value || "";
      } else {
        text = readFileUtf8(filePath);
      }
      safeUnlink(filePath);
    } else if (req.body.text) {
      text = String(req.body.text);
    } else {
      return res.status(400).json({ error: "No file or text provided" });
    }

    const kw = { keywords: [], skillsFound: [], topTokens: [] };

    const payload = {
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return strict JSON." },
        { role: "user", content: text.slice(0, 6000) },
      ],
    };

    const openaiResult = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await openaiResult.text();
    let parsed = null;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = extractJsonFromText(rawText);
    }

    if (!parsed) {
      return res.json({
        raw: rawText,
        atsScore: estimateAtsScoreFromText(text, kw),
        keywords: kw.keywords,
        skillsFound: kw.skillsFound,
        topTokens: kw.topTokens,
      });
    }

    if (!parsed.atsScore || isNaN(parsed.atsScore)) {
      parsed.atsScore = estimateAtsScoreFromText(text, kw);
    }

    return res.json(parsed);
  } catch (err) {
    console.error("Analyze error:", err);
    safeUnlink(filePath);
    return res.status(500).json({ error: "Analysis failed" });
  }
});
// =====================================================
//  AUTH ROUTES (DEMO / IN-MEMORY)
// =====================================================
const users = [];

app.post("/api/auth/register", (req, res) => {
  try {
    const { fullName, email, password, role, company } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({
        error: "fullName, email, password and role are required",
      });
    }

    const existing = users.find((u) => u.email === email);
    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    const user = {
      id: users.length + 1,
      fullName,
      email,
      password, // demo only (no hashing)
      role,
      company: role === "recruiter" ? company || "" : undefined,
      createdAt: new Date().toISOString(),
    };

    users.push(user);

    return res.json({
      message: "Registration successful",
      token: `mock-token-${user.id}`,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        company: user.company,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password, role } = req.body;

    const user = users.find((u) => u.email === email);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (role && user.role !== role) {
      return res.status(403).json({
        error: `Account is registered as ${user.role}`,
      });
    }

    return res.json({
      message: "Login successful",
      token: `mock-token-${user.id}`,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        company: user.company,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// =====================================================
//  LIST ALL JOBS (CANDIDATE – OPEN POSITIONS)
// =====================================================
app.get("/api/jobs", async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 }).lean();
    res.json(jobs);
  } catch (err) {
    console.error("Fetch jobs error:", err);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});


// =====================================================
//  SERVE FRONTEND (RENDER FIX)
// =====================================================
const DIST_DIR = path.join(__dirname, "dist");

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).end();
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
} else {
  console.warn("⚠️ dist folder not found — run npm run build");
}

// -------- Health --------
app.get("/healthz", (_, res) =>
  res.json({ status: "ok", time: new Date().toISOString() })
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on PORT=${PORT}`);
});

