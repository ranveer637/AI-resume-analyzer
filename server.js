// server.js (DB-backed auth + JWT)
// Replace your existing server.js with this file.
// Requires: mongoose, bcrypt, jsonwebtoken, express, multer, pdf-parse, mammoth, cors, node-fetch, dotenv, express-rate-limit

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
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------- Rate limiting ----------
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ---------- Uploads dir ----------
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ---------- MongoDB ----------
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB = process.env.MONGODB_DB || "ai-resume-analyzer";

if (!MONGODB_URI) {
  console.warn("⚠️ MONGODB_URI not set — database features disabled until configured.");
} else {
  mongoose
    .connect(MONGODB_URI, { dbName: MONGODB_DB })
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));
}

// ---------- USER model (for persistent auth) ----------
const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["candidate", "recruiter", "admin"], required: true },
  company: { type: String }, // optional for recruiters
  createdAt: { type: Date, default: Date.now }
}, { collection: "users" });

const User = mongoose.models?.User || mongoose.model("User", UserSchema);

// ---------- Job & Application schemas (unchanged, but included for completeness) ----------
const ApplicationSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
  candidateName: { type: String, required: true },
  candidateEmail: { type: String, required: true },
  atsScore: { type: Number },
  notes: { type: String },
  resumePath: { type: String },
  resumeFilename: { type: String },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const JobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  companyName: { type: String, required: true },
  location: { type: String, default: "Not specified" },
  qualifications: { type: String, required: true },
  description: { type: String, default: "" },
  recruiterEmail: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  applications: [ApplicationSchema],
}, { collection: "jobs" });

const Job = mongoose.models?.Job || mongoose.model("Job", JobSchema);

// ---------- Utility helpers (keyword extraction, PDF parse, AI retry) ----------
// (Keep these identical to your previous server: tokenizeForKeywords, extractKeywords, estimateAtsScoreFromText, safeUnlink, readFileUtf8, safeParsePdfBuffer, callOpenAIWithRetries, etc.)
// For brevity, I'm including the same helpers from your last working server — copy them exactly from your server, and ensure SKILLS_LIST and stopwords exist.
// --- BEGIN helpers (copy over from previous server file) ---
const COMMON_STOPWORDS = new Set([
  "a","an","the","and","or","of","to","in","on","for","with","by","as","is","are","was","were",
  "be","been","has","have","had","that","this","these","those","at","from","it","its","but","not",
  "can","will","would","should","i","you","he","she","they","we","my","your","our","their","them",
  "which","who","what","when","where","how","about","into","over","after","before","during","per"
]);

const SKILLS_LIST = [
  "javascript","typescript","react","react.js","react-native","vue","angular","node.js","node","express",
  "html","css","tailwind","bootstrap","redux","graphql","rest","api","mongodb","mysql","postgresql",
  "docker","kubernetes","aws","azure","gcp","git","github","gitlab","jest","mocha","cypress","selenium",
  "python","pandas","numpy","scikit-learn","tensorflow","pytorch","java","c++","c#","php","ruby",
  "machine learning","nlp","data analysis","sql","linux","bash","figma","photoshop","ui/ux","leadership",
  "communication","agile","scrum","devops","testing","ci/cd","performance","optimization","security"
].map(s => s.toLowerCase());

function tokenizeForKeywords(text) {
  return text
    .replace(/[\u2012\u2013\u2014]/g, "-")
    .replace(/[^\w\- ]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function extractKeywords(text, opts = {}) {
  const tokens = tokenizeForKeywords(text);
  const freq = new Map();

  for (const t of tokens) {
    if (t.length < 2 || /^\d+$/.test(t)) continue;
    if (COMMON_STOPWORDS.has(t)) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }

  const freqEntries = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);

  const foundSkills = new Map();
  const words = tokens;
  for (let i = 0; i < words.length; i++) {
    for (let n = 1; n <= 3 && i + n <= words.length; n++) {
      const phrase = words.slice(i, i + n).join(" ");
      if (phrase.length < 2) continue;
      if (SKILLS_LIST.includes(phrase)) {
        foundSkills.set(phrase, (foundSkills.get(phrase) || 0) + 1);
      }
    }
  }

  const topFrequent = [];
  const maxFreqTokens = opts.maxFreqTokens || 12;
  for (const [token, count] of freqEntries) {
    if (foundSkills.has(token)) continue;
    if (token.length <= 2) continue;
    topFrequent.push({ token, count });
    if (topFrequent.length >= maxFreqTokens) break;
  }

  const skillList = Array.from(foundSkills.entries()).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const topTokens = topFrequent.map(x => x.token);
  const combined = [...skillList, ...topTokens].filter((v, i, a) => a.indexOf(v) === i);

  return {
    keywords: combined.slice(0, 30),
    skillsFound: skillList,
    topTokens: topTokens.slice(0, 30),
  };
}

function estimateAtsScoreFromText(text, kw) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const length = words.length;
  const keywordCount = (kw?.keywords || []).length;

  let score = 40;
  if (length > 150) score += 10;
  if (length > 300) score += 10;
  if (keywordCount > 5) score += 10;
  if (keywordCount > 10) score += 10;
  if (keywordCount > 15) score += 10;
  if (score < 30) score = 30;
  if (score > 95) score = 95;
  return score;
}

function safeUnlink(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
}
function readFileUtf8(filePath) { return fs.readFileSync(filePath, "utf8"); }

async function safeParsePdfBuffer(buffer) {
  try {
    const data = await pdf(buffer);
    return data?.text || "";
  } catch (err) {
    console.warn("PDF parse failed:", err?.message || err);
    return "";
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callOpenAIWithRetries(payload, attempts = 4, baseDelay = 600) {
  let lastErr = "";
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      if (resp.ok) return { ok: true, text, status: resp.status };
      lastErr = `status=${resp.status} body=${text}`;
      if (resp.status !== 429 && !(resp.status >= 500 && resp.status < 600)) {
        return { ok: false, text, status: resp.status };
      }
    } catch (err) {
      lastErr = String(err?.message || err);
    }
    const delay = Math.floor(baseDelay * Math.pow(2, i) + Math.random() * 200);
    console.warn(`OpenAI attempt ${i+1} failed. Retrying in ${delay}ms. err=${lastErr}`);
    await sleep(delay);
  }
  return { ok: false, text: lastErr || "exhausted retries", status: 429 };
}
// --- END helpers ---


// ---------- JWT helpers & middleware ----------
const JWT_SECRET = process.env.JWT_SECRET || "please_set_a_strong_jwt_secret";
const JWT_EXPIRES = "30d"; // adjust as needed

function signUserToken(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, role: user.role, fullName: user.fullName },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

async function authMiddleware(req, res, next) {
  try {
    const auth = (req.headers.authorization || "").split(" ");
    if (auth.length !== 2 || auth[0] !== "Bearer") {
      req.user = null;
      return next();
    }
    const token = auth[1];
    const payload = jwt.verify(token, JWT_SECRET);
    // attach user minimal info
    req.user = { id: payload.sub, email: payload.email, role: payload.role, fullName: payload.fullName };
    return next();
  } catch (err) {
    // token invalid -> treat as unauthenticated
    req.user = null;
    return next();
  }
}

// Use auth middleware globally so routes can check req.user
app.use(authMiddleware);

// =====================================================
//  AUTH ROUTES (now persistent in MongoDB)
// =====================================================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { fullName, email, password, role, company } = req.body;
    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ error: "fullName, email, password and role are required." });
    }
    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ error: "User already exists. Please login." });

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const user = await User.create({ fullName, email, passwordHash, role, company: role === "recruiter" ? company || "" : undefined });
    const token = signUserToken(user);
    return res.json({ message: "Registration successful.", token, user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role, company: user.company } });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Internal error during registration." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials." });

    const token = signUserToken(user);
    return res.json({ message: "Login successful.", token, user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role, company: user.company } });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal error during login." });
  }
});

// Protected helper: require recruiter
function requireRecruiter(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required." });
  if (req.user.role !== "recruiter") return res.status(403).json({ error: "Recruiter access required." });
  return next();
}

// =====================================================
//  JOB ROUTES (now using authenticated user where appropriate)
// =====================================================

// Recruiter creates a job post — require recruiter & use req.user.email as recruiterEmail
app.post("/api/recruiter/jobs", requireRecruiter, async (req, res) => {
  try {
    const { title, companyName, location, qualifications, description } = req.body;
    const recruiterEmail = req.user.email;
    if (!title || !companyName || !qualifications) {
      return res.status(400).json({ error: "title, companyName, qualifications required." });
    }
    const job = await Job.create({ title, companyName, location: location || "Not specified", qualifications, description: description || "", recruiterEmail });
    return res.json({ message: "Job created successfully.", job });
  } catch (err) {
    console.error("Create job error:", err);
    return res.status(500).json({ error: "Failed to create job." });
  }
});

// Candidate: list all jobs (public)
app.get("/api/jobs", async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 }).lean();
    return res.json(jobs);
  } catch (err) {
    console.error("List jobs error:", err);
    return res.status(500).json({ error: "Failed to fetch jobs." });
  }
});

// Recruiter: list own jobs (must be authenticated recruiter)
app.get("/api/recruiter/jobs", requireRecruiter, async (req, res) => {
  try {
    const recruiterEmail = req.user.email;
    const jobs = await Job.find({ recruiterEmail }).sort({ createdAt: -1 }).lean();
    return res.json(jobs);
  } catch (err) {
    console.error("List recruiter jobs error:", err);
    return res.status(500).json({ error: "Failed to fetch recruiter jobs." });
  }
});

// Candidate applies to job. If user authenticated and role === candidate, use their info. Otherwise accept candidateName/email from body.
// Accepts file upload
app.post("/api/jobs/:jobId/apply", upload.single("file"), async (req, res) => {
  let filePath = null;
  try {
    const { jobId } = req.params;

    // Prefer authenticated candidate info when present
    let candidateName = req.body.candidateName || req.body.name;
    let candidateEmail = req.body.candidateEmail || req.body.email;
    if (req.user && req.user.role === "candidate") {
      candidateName = req.user.fullName;
      candidateEmail = req.user.email;
    }

    const atsScore = req.body.atsScore ? Number(req.body.atsScore) : undefined;
    const notes = req.body.notes || "";

    if (!candidateName || !candidateEmail) {
      if (req.file && req.file.path) safeUnlink(req.file.path);
      return res.status(400).json({ error: "candidateName and candidateEmail are required." });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      if (req.file && req.file.path) safeUnlink(req.file.path);
      return res.status(404).json({ error: "Job not found." });
    }

    const appObj = {
      _id: new mongoose.Types.ObjectId(),
      candidateName,
      candidateEmail,
      atsScore,
      notes,
      createdAt: new Date(),
    };

    if (req.file && req.file.path) {
      filePath = req.file.path;
      appObj.resumePath = filePath;
      appObj.resumeFilename = req.file.originalname || "resume";
    }

    job.applications.push(appObj);
    await job.save();

    return res.json({ message: "Application submitted successfully.", applicationId: appObj._id });
  } catch (err) {
    console.error("Apply job error:", err);
    if (req.file && req.file.path) safeUnlink(req.file.path);
    return res.status(500).json({ error: "Failed to apply for job." });
  }
});

// Serve resume file inline (only recruiter for that job or admin can view) -- authorization enforced
app.get("/api/applications/:appId/resume", async (req, res) => {
  try {
    const { appId } = req.params;
    if (!appId) return res.status(400).json({ error: "appId required" });

    // Find job containing this application
    const job = await Job.findOne({ "applications._id": appId }).lean();
    if (!job) return res.status(404).json({ error: "Application not found" });

    const application = job.applications.find((a) => String(a._id) === String(appId));
    if (!application) return res.status(404).json({ error: "Application not found" });

    // Authorization: only the recruiter who owns the job, or admin, or the candidate themselves may view
    const viewer = req.user;
    if (viewer) {
      const isRecruiterOwner = viewer.role === "recruiter" && viewer.email === job.recruiterEmail;
      const isAdmin = viewer.role === "admin";
      const isCandidateSelf = viewer.role === "candidate" && viewer.email === application.candidateEmail;
      if (!isRecruiterOwner && !isAdmin && !isCandidateSelf) {
        return res.status(403).json({ error: "Not authorized to view this resume." });
      }
    } else {
      // Unauthenticated requests are not allowed to view file
      return res.status(401).json({ error: "Authentication required to view resume." });
    }

    if (!application.resumePath) return res.status(404).json({ error: "No resume uploaded for this application." });

    const resumePath = application.resumePath;
    const filename = application.resumeFilename || "resume.pdf";

    const absUploads = path.resolve(UPLOADS_DIR);
    const absResume = path.resolve(resumePath);
    if (!absResume.startsWith(absUploads)) {
      console.warn("Resume path outside uploads dir:", absResume);
      return res.status(400).json({ error: "Invalid resume path." });
    }
    if (!fs.existsSync(absResume)) return res.status(404).json({ error: "Resume file missing on server." });

    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
    return res.sendFile(absResume);
  } catch (err) {
    console.error("Get resume error:", err);
    return res.status(500).json({ error: "Failed to retrieve resume." });
  }
});

// =====================================================
//  PARSE & ANALYZE (unchanged from prior)
// =====================================================
// Reuse the parse/analyze endpoints from your current server (copy them verbatim).
// For brevity here: include your /api/parse and /api/analyze route implementations (exactly as in your working server).
// Make sure they still exist here (I assume you already had them).

// ---------- Static serve if built frontend exists ----------
const DIST_DIR = path.join(__dirname, "dist");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
} else {
  console.warn("dist folder not found — run `npm run build` to generate it.");
}

app.get("/healthz", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on PORT=${PORT}`);
  if (!process.env.OPENAI_API_KEY) console.warn("OPENAI_API_KEY not set — running in mock mode.");
});
