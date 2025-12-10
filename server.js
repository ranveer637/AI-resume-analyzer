// server.js
// Express backend for AI Resume Analyzer + Job Board
// - Auth (in-memory, demo)
// - File upload & parsing (PDF/DOCX/TXT)
// - OpenAI analysis (or mock mode)
// - MongoDB (Mongoose) for Job Posts + Applications

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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// -------- Rate limiting --------
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// -------- MongoDB connection --------
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.warn("⚠️ MONGODB_URI is not set. Job posting features will not work.");
}

mongoose
  .connect(MONGODB_URI, {
    dbName: process.env.MONGODB_DB || "ai-resume-analyzer",
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// -------- Mongoose Schemas --------
const ApplicationSchema = new mongoose.Schema(
  {
    candidateName: { type: String, required: true },
    candidateEmail: { type: String, required: true },
    atsScore: { type: Number },
    notes: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const JobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    companyName: { type: String, required: true },
    location: { type: String, default: "Not specified" },
    qualifications: { type: String, required: true },
    description: { type: String, default: "" },
    recruiterEmail: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    applications: [ApplicationSchema],
  },
  { collection: "jobs" }
);

const Job = mongoose.model("Job", JobSchema);

// -------- Uploads directory --------
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 15 * 1024 * 1024 },
});

// -------- In-memory fake users (for demo only) --------
const users = [];

// -------- Keyword extraction helpers --------
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
].map((s) => s.toLowerCase());

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

  const skillList = Array.from(foundSkills.entries())
    .sort((a, b) => b[1] - a[1])
    .map((x) => x[0]);

  const topTokens = topFrequent.map((x) => x.token);
  const combined = [...skillList, ...topTokens].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  return {
    keywords: combined.slice(0, 30),
    skillsFound: skillList,
    topTokens: topTokens.slice(0, 30),
  };
}

// -------- ATS score heuristic fallback --------
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

// -------- Helpers --------
function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

function readFileUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractJsonFromText(text) {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {}
  const firstCurly = text.indexOf("{");
  const lastCurly = text.lastIndexOf("}");
  if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
    try {
      return JSON.parse(text.slice(firstCurly, lastCurly + 1));
    } catch {}
  }
  return null;
}

// -------- Safe PDF parsing --------
async function safeParsePdfBuffer(buffer) {
  try {
    const data = await pdf(buffer);
    return data?.text || "";
  } catch (err) {
    console.warn("PDF parse failed (pdf-parse):", err?.message || err);
    return "";
  }
}

// -------- OpenAI with retries --------
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenAIWithRetries(payload, attempts = 5, baseDelay = 800) {
  let lastErrText = null;
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

      const txt = await resp.text();

      if (resp.ok) {
        return { ok: true, text: txt, status: resp.status };
      }

      lastErrText = `status=${resp.status} body=${txt}`;
      if (resp.status !== 429 && !(resp.status >= 500 && resp.status < 600)) {
        return { ok: false, text: txt, status: resp.status };
      }
    } catch (err) {
      lastErrText = String(err?.message || err);
    }

    const delay = Math.floor(baseDelay * Math.pow(2, i) + Math.random() * 300);
    console.warn(
      `OpenAI request failed (attempt ${i + 1}/${attempts}). Retrying in ${delay}ms. Last error: ${lastErrText}`
    );
    await sleep(delay);
  }
  return { ok: false, text: lastErrText || "exhausted retries", status: 429 };
}

// =====================================================
//  AUTH ROUTES (FAKE, IN-MEMORY)
// =====================================================

app.post("/api/auth/register", (req, res) => {
  try {
    const { fullName, email, password, role, company } = req.body;
    if (!fullName || !email || !password || !role) {
      return res
        .status(400)
        .json({ error: "fullName, email, password and role are required." });
    }
    const existing = users.find((u) => u.email === email);
    if (existing) {
      return res.status(409).json({ error: "User already exists. Please log in." });
    }

    const user = {
      id: users.length + 1,
      fullName,
      email,
      password,
      role,
      company: role === "recruiter" ? company || "" : undefined,
      createdAt: new Date().toISOString(),
    };
    users.push(user);

    const token = `mock-token-${user.id}-${Date.now()}`;
    return res.json({
      message: "Registration successful.",
      token,
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
    return res.status(500).json({ error: "Internal error during registration." });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({ error: "User not found. Please register." });
    }
    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid password." });
    }
    if (role && user.role !== role) {
      return res.status(403).json({
        error: `This account is registered as "${user.role}", not "${role}".`,
      });
    }

    const token = `mock-token-${user.id}-${Date.now()}`;
    return res.json({
      message: "Login successful.",
      token,
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
    return res.status(500).json({ error: "Internal error during login." });
  }
});

// =====================================================
//  JOB ROUTES (MongoDB)
// =====================================================

// Recruiter creates a job post
app.post("/api/recruiter/jobs", async (req, res) => {
  try {
    const { title, companyName, location, qualifications, description, recruiterEmail } =
      req.body;

    if (!title || !companyName || !qualifications || !recruiterEmail) {
      return res.status(400).json({
        error: "title, companyName, qualifications, and recruiterEmail are required.",
      });
    }

    const job = await Job.create({
      title,
      companyName,
      location: location || "Not specified",
      qualifications,
      description: description || "",
      recruiterEmail,
    });

    return res.json({ message: "Job created successfully.", job });
  } catch (err) {
    console.error("Create job error:", err);
    return res.status(500).json({ error: "Failed to create job." });
  }
});

// Candidate: list all jobs
app.get("/api/jobs", async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 }).lean();
    return res.json(jobs);
  } catch (err) {
    console.error("List jobs error:", err);
    return res.status(500).json({ error: "Failed to fetch jobs." });
  }
});

// Recruiter: list own jobs
app.get("/api/recruiter/jobs", async (req, res) => {
  try {
    const { recruiterEmail } = req.query;
    if (!recruiterEmail) {
      return res.status(400).json({ error: "recruiterEmail is required in query." });
    }
    const jobs = await Job.find({ recruiterEmail }).sort({ createdAt: -1 }).lean();
    return res.json(jobs);
  } catch (err) {
    console.error("List recruiter jobs error:", err);
    return res.status(500).json({ error: "Failed to fetch recruiter jobs." });
  }
});

// Candidate applies to a job
app.post("/api/jobs/:jobId/apply", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { candidateName, candidateEmail, atsScore, notes } = req.body;

    if (!candidateName || !candidateEmail) {
      return res
        .status(400)
        .json({ error: "candidateName and candidateEmail are required." });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }

    job.applications.push({
      candidateName,
      candidateEmail,
      atsScore,
      notes,
    });

    await job.save();

    return res.json({ message: "Application submitted successfully." });
  } catch (err) {
    console.error("Apply job error:", err);
    return res.status(500).json({ error: "Failed to apply for job." });
  }
});

// =====================================================
//  PARSE + ANALYZE ROUTES (existing)
// =====================================================

app.post("/api/parse", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded." });

  const filePath = file.path;
  const originalName = file.originalname || "";
  const mimetype = file.mimetype || "";

  try {
    let text = "";

    if (mimetype === "application/pdf" || originalName.toLowerCase().endsWith(".pdf")) {
      const buffer = fs.readFileSync(filePath);
      text = await safeParsePdfBuffer(buffer);
    } else if (originalName.toLowerCase().endsWith(".docx")) {
      const result = await mammoth.extractRawText({ path: filePath });
      text = result?.value || "";
    } else {
      text = readFileUtf8(filePath);
    }

    safeUnlink(filePath);

    if (!text || text.trim().length === 0) {
      return res.status(200).json({
        text: "",
        keywords: [],
        skillsFound: [],
        topTokens: [],
        message: "No extractable text found. The file might be scanned or corrupted.",
      });
    }

    const kw = extractKeywords(text);
    return res.json({
      text,
      keywords: kw.keywords,
      skillsFound: kw.skillsFound,
      topTokens: kw.topTokens,
    });
  } catch (err) {
    safeUnlink(filePath);
    console.error("Parse error:", err);
    return res.status(500).json({
      error: "Failed to parse file",
      message: err?.message || String(err),
    });
  }
});

app.post("/api/analyze", upload.single("file"), async (req, res) => {
  let filePath;
  try {
    let text = "";

    if (req.file) {
      filePath = req.file.path;
      const originalName = req.file.originalname || "";
      const mimetype = req.file.mimetype || "";

      if (mimetype === "application/pdf" || originalName.toLowerCase().endsWith(".pdf")) {
        const buffer = fs.readFileSync(filePath);
        text = await safeParsePdfBuffer(buffer);
      } else if (originalName.toLowerCase().endsWith(".docx")) {
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

    if (!text || text.trim().length < 10) {
      return res.status(400).json({
        error: "Parsed text is empty or too short",
        parsedLength: text?.length || 0,
      });
    }

    const kw = extractKeywords(text);

    const USE_MOCK =
      process.env.OPENAI_MOCK === "true" || !process.env.OPENAI_API_KEY;
    if (USE_MOCK) {
      const mock = {
        atsScore: estimateAtsScoreFromText(text, kw),
        topSkills: ["JavaScript", "React", "Node.js"],
        suggestions: [
          "Add measurable metrics to achievements.",
          "Move skills to a prominent top section.",
          "Use action verbs in bullet points.",
        ],
        rewrittenBullets: [
          "Optimized page load time by 40% by introducing code-splitting and lazy-loading.",
          "Led a 3-person team to deliver a major feature two sprints early.",
        ],
        keywords: kw.keywords,
        skillsFound: kw.skillsFound,
        topTokens: kw.topTokens,
      };
      return res.json(mock);
    }

    const prompt = `You are an expert resume reviewer. Given the resume text between triple backticks, return ONLY valid JSON with keys:
- atsScore (integer 0-100),
- topSkills (array of strings),
- suggestions (array of strings),
- rewrittenBullets (array of strings, up to 6),
- keywords (array of strings listing main keywords/skills found).

Resume:
\`\`\`
${text.slice(0, 6000)}
\`\`\``;

    const payload = {
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful resume reviewer that outputs strict JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 700,
    };

    const openaiResult = await callOpenAIWithRetries(payload, 5, 800);

    if (!openaiResult.ok) {
      console.error("OpenAI call failed after retries:", openaiResult);

      if (openaiResult.status && openaiResult.status !== 429) {
        return res.status(502).json({
          error: "AI provider returned an error",
          status: openaiResult.status,
          details: openaiResult.text,
        });
      }

      return res.status(200).json({
        error:
          "AI provider rate-limited or unavailable. Returning keyword-only analysis.",
        details: openaiResult.text,
        atsScore: estimateAtsScoreFromText(text, kw),
        keywords: kw.keywords,
        skillsFound: kw.skillsFound,
        topTokens: kw.topTokens,
      });
    }

    const rawText = openaiResult.text;
    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = extractJsonFromText(rawText);
    }

    if (!parsed) {
      return res.status(200).json({
        raw: rawText,
        atsScore: estimateAtsScoreFromText(text, kw),
        keywords: kw.keywords,
        skillsFound: kw.skillsFound,
        topTokens: kw.topTokens,
      });
    }

    if (!parsed.keywords) parsed.keywords = kw.keywords;
    if (!parsed.skillsFound) parsed.skillsFound = kw.skillsFound;
    if (!parsed.topTokens) parsed.topTokens = kw.topTokens;

    if (
      parsed.atsScore === undefined ||
      parsed.atsScore === null ||
      Number.isNaN(Number(parsed.atsScore))
    ) {
      parsed.atsScore = estimateAtsScoreFromText(text, kw);
    } else {
      let n = Number(parsed.atsScore);
      if (!Number.isFinite(n)) {
        n = estimateAtsScoreFromText(text, kw);
      }
      if (n < 0) n = 0;
      if (n > 100) n = 100;
      parsed.atsScore = Math.round(n);
    }

    return res.json(parsed);
  } catch (err) {
    console.error("Analyze error:", err);
    safeUnlink(filePath);
    return res.status(500).json({
      error: "Analysis failed",
      message: err?.message || String(err),
    });
  }
});

// =====================================================
//  STATIC FRONTEND
// =====================================================

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

app.get("/healthz", (_, res) =>
  res.json({ status: "ok", time: new Date().toISOString() })
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on PORT=${PORT}`);
});
