// server.js
// AI Resume Analyzer + Job Board (Render-ready)

import express from "express";
import multer from "multer";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import cors from "cors";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";

dotenv.config();

/* -------------------------------------------------- */
/*  BASIC SETUP                                       */
/* -------------------------------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
  })
);

/* -------------------------------------------------- */
/*  MONGODB                                          */
/* -------------------------------------------------- */

mongoose
  .connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || "ai-resume-analyzer",
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

/* -------------------------------------------------- */
/*  SCHEMAS                                          */
/* -------------------------------------------------- */

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

/* -------------------------------------------------- */
/*  DIRECTORIES (NO mkdirp)                           */
/* -------------------------------------------------- */

const UPLOADS_DIR = path.join(__dirname, "uploads");
const RESUMES_DIR = path.join(UPLOADS_DIR, "resumes");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(RESUMES_DIR)) fs.mkdirSync(RESUMES_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR });

// Serve resume PDFs
app.use("/resumes", express.static(RESUMES_DIR));

/* -------------------------------------------------- */
/*  HELPERS                                          */
/* -------------------------------------------------- */

function safeUnlink(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

async function safeParsePdfBuffer(buffer) {
  try {
    const data = await pdf(buffer);
    return data?.text || "";
  } catch {
    return "";
  }
}

function generatePdfFromText(text, base = "resume") {
  return new Promise((resolve) => {
    const filename = `${base}-${Date.now()}.pdf`;
    const filepath = path.join(RESUMES_DIR, filename);

    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    doc.fontSize(16).text("Resume", { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(text || " ");

    doc.end();
    stream.on("finish", () => resolve(filename));
  });
}

/* -------------------------------------------------- */
/*  AUTH (IN-MEMORY – DEMO)                           */
/* -------------------------------------------------- */

const users = [];

app.post("/api/auth/register", (req, res) => {
  const { fullName, email, password, role, company } = req.body;

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (users.find((u) => u.email === email)) {
    return res.status(409).json({ error: "User already exists" });
  }

  const user = {
    id: users.length + 1,
    fullName,
    email,
    password,
    role,
    company: role === "recruiter" ? company || "" : undefined,
  };

  users.push(user);

  res.json({
    token: `mock-token-${user.id}`,
    user: {
      id: user.id,
      fullName,
      email,
      role,
      company: user.company,
    },
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password, role } = req.body;

  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  if (role && user.role !== role) {
    return res.status(403).json({ error: "Role mismatch" });
  }

  res.json({
    token: `mock-token-${user.id}`,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      company: user.company,
    },
  });
});

/* -------------------------------------------------- */
/*  JOB ROUTES                                       */
/* -------------------------------------------------- */

// Candidate – list jobs
app.get("/api/jobs", async (_, res) => {
  const jobs = await Job.find().sort({ createdAt: -1 }).lean();
  res.json(jobs);
});

// Recruiter – create job
app.post("/api/recruiter/jobs", async (req, res) => {
  const { title, companyName, location, qualifications, description, recruiterEmail } = req.body;

  if (!title || !companyName || !qualifications || !recruiterEmail) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const job = await Job.create({
    title,
    companyName,
    location: location || "Not specified",
    qualifications,
    description: description || "",
    recruiterEmail,
  });

  res.json({ message: "Job created", job });
});

// Recruiter – fetch own jobs
app.get("/api/recruiter/jobs", async (req, res) => {
  const { recruiterEmail } = req.query;
  if (!recruiterEmail) return res.status(400).json({ error: "recruiterEmail required" });

  const jobs = await Job.find({ recruiterEmail }).sort({ createdAt: -1 }).lean();
  res.json(jobs);
});

/* -------------------------------------------------- */
/*  APPLY TO JOB (SAVE RESUME PDF)                    */
/* -------------------------------------------------- */

app.post("/api/jobs/:jobId/apply", upload.single("file"), async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });

    let resumeText = req.body.resumeText || "";
    let resumeFilename;

    if (req.file) {
      const name = req.file.originalname.toLowerCase();

      if (name.endsWith(".pdf")) {
        resumeFilename = `${Date.now()}-${req.file.originalname}`;
        fs.renameSync(req.file.path, path.join(RESUMES_DIR, resumeFilename));
      } else {
        if (name.endsWith(".docx")) {
          resumeText = (await mammoth.extractRawText({ path: req.file.path })).value;
        } else {
          resumeText = fs.readFileSync(req.file.path, "utf8");
        }
        resumeFilename = await generatePdfFromText(resumeText, req.body.candidateEmail || "candidate");
        safeUnlink(req.file.path);
      }
    } else if (resumeText) {
      resumeFilename = await generatePdfFromText(resumeText, req.body.candidateEmail || "candidate");
    }

    const resumeUrl = resumeFilename
      ? `${req.protocol}://${req.get("host")}/resumes/${resumeFilename}`
      : null;

    job.applications.push({
      candidateName: req.body.candidateName,
      candidateEmail: req.body.candidateEmail,
      atsScore: req.body.atsScore,
      notes: req.body.notes,
      resumeUrl,          // ✅ FIXED
      resumeText,
    });

    await job.save();
    res.json({ message: "Applied successfully", resumeUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Apply failed" });
  }
});
// =====================================================
// =====================================================
//  PARSE RESUME + EXTRACT KEYWORDS (FOR UI)
// =====================================================
app.post("/api/parse", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = file.path;
  const originalName = file.originalname.toLowerCase();

  try {
    let text = "";

    if (originalName.endsWith(".pdf")) {
      text = await safeParsePdfBuffer(fs.readFileSync(filePath));
    } else if (originalName.endsWith(".docx")) {
      text = (await mammoth.extractRawText({ path: filePath })).value || "";
    } else if (originalName.endsWith(".txt")) {
      text = fs.readFileSync(filePath, "utf8");
    }

    safeUnlink(filePath);

    if (!text || !text.trim()) {
      return res.json({
        text: "",
        keywords: [],
        skillsFound: [],
        topTokens: [],
        message: "No extractable text found",
      });
    }

    // ---------- KEYWORD EXTRACTION ----------
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const freq = {};
    tokens.forEach((t) => {
      freq[t] = (freq[t] || 0) + 1;
    });

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);

    const keywords = sorted.slice(0, 20).map(([w]) => w);
    const skillsFound = keywords.slice(0, 10);
    const topTokens = keywords.slice(0, 15);

    return res.json({
      text,
      keywords,
      skillsFound,
      topTokens,
    });
  } catch (err) {
    console.error("Parse error:", err);
    safeUnlink(filePath);
    res.status(500).json({ error: "Failed to parse resume" });
  }
});

// =====================================================
//  ANALYZE RESUME (ATS + AI FEEDBACK)
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
        text = fs.readFileSync(filePath, "utf8");
      }
      safeUnlink(filePath);
    } else if (req.body.text) {
      text = String(req.body.text);
    } else {
      return res.status(400).json({ error: "No resume text provided" });
    }

    if (!text || text.trim().length < 20) {
      return res.json({
        atsScore: 30,
        topSkills: [],
        suggestions: ["Resume text is too short"],
        rewrittenBullets: [],
        keywords: [],
        skillsFound: [],
        topTokens: [],
      });
    }

    // ---- SIMPLE KEYWORD EXTRACTION ----
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const freq = {};
    tokens.forEach((t) => (freq[t] = (freq[t] || 0) + 1));

    const keywords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([k]) => k);

    // ---- ATS SCORE (HEURISTIC) ----
    let atsScore = 40;
    if (text.length > 500) atsScore += 10;
    if (keywords.length > 5) atsScore += 10;
    if (keywords.length > 10) atsScore += 10;
    atsScore = Math.min(95, atsScore);

    // ---- MOCK AI FEEDBACK (SAFE FALLBACK) ----
    return res.json({
      atsScore,
      topSkills: keywords.slice(0, 5),
      suggestions: [
        "Add measurable achievements",
        "Improve resume summary",
        "Highlight technical skills clearly",
      ],
      rewrittenBullets: [
        "Improved system performance by optimizing backend APIs.",
      ],
      keywords,
      skillsFound: keywords,
      topTokens: keywords,
    });
  } catch (err) {
    console.error("Analyze error:", err);
    safeUnlink(filePath);
    return res.status(500).json({ error: "Analysis failed" });
  }
});

app.post("/api/jobs/:jobId/apply", upload.single("file"), async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    let resumeText = "";
    let resumeFilename;

    // Handle uploaded file
    if (req.file) {
      const name = req.file.originalname.toLowerCase();

      if (name.endsWith(".pdf")) {
        resumeFilename = `${Date.now()}-${req.file.originalname}`;
        fs.renameSync(req.file.path, path.join(RESUMES_DIR, resumeFilename));
      } else if (name.endsWith(".docx")) {
        resumeText =
          (await mammoth.extractRawText({ path: req.file.path })).value || "";
        resumeFilename = await generatePdfFromText(resumeText, req.body.candidateEmail || "candidate");
        fs.unlinkSync(req.file.path);
      }
    }

    const resumeUrl = resumeFilename
      ? `${req.protocol}://${req.get("host")}/resumes/${resumeFilename}`
      : null;

    // 🔴 THIS CREATES applications[]
    job.applications.push({
      candidateName: req.body.candidateName,
      candidateEmail: req.body.candidateEmail,
      atsScore: req.body.atsScore,
      resumeUrl,
      appliedAt: new Date(),
    });

    await job.save(); // 🔴 WITHOUT THIS NOTHING SAVES

    res.json({ message: "Applied successfully", resumeUrl });
  } catch (err) {
    console.error("Apply error:", err);
    res.status(500).json({ error: "Apply failed" });
  }
});

/* -------------------------------------------------- */
/*  STATIC FRONTEND (RENDER FIX)                      */
/* -------------------------------------------------- */

const DIST_DIR = path.join(__dirname, "dist");

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).end();
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
} else {
  console.warn("⚠️ dist folder not found – run npm run build");
}

/* -------------------------------------------------- */

app.get("/healthz", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
