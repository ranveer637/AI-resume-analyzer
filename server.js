// server.js
// FINAL – Render compatible, no mkdirp, resume PDF saved, ATS + keywords work

import express from "express";
import multer from "multer";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import cors from "cors";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";

dotenv.config();

/* -------------------------------------------------- */
/* BASIC SETUP */
/* -------------------------------------------------- */
const BASE_URL =
  process.env.PUBLIC_BACKEND_URL ||
  "https://ai-resume-analyzer-3bfr.onrender.com";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* -------------------------------------------------- */
/* RATE LIMIT */
/* -------------------------------------------------- */
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
  })
);

/* -------------------------------------------------- */
/* MONGODB */
/* -------------------------------------------------- */
mongoose
  .connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || "ai-resume-analyzer",
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((e) => console.error("❌ Mongo error", e));

/* -------------------------------------------------- */
/* SCHEMAS */
/* -------------------------------------------------- */
const UserSchema = new mongoose.Schema({
  fullName: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  company: String,
  verificationStatus: {
    type: String,
    enum: ["unverified", "pending", "verified"],
    default: "unverified"
  },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);

const ApplicationSchema = new mongoose.Schema(
  {
    candidateName: String,
    candidateEmail: String,
    atsScore: Number,
    resumeUrl: String,   // ✅ PDF link
    resumeText: String,  // ✅ optional
    notes: String,       // ✅ optional
    appliedAt: Date,
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
  createdAt: { type: Date, default: Date.now },
  applications: [ApplicationSchema],
});

const Job = mongoose.model("Job", JobSchema);

/* -------------------------------------------------- */
/* FILE SYSTEM (NO mkdirp) */
/* -------------------------------------------------- */
const UPLOADS_DIR = path.join(__dirname, "uploads");
const RESUMES_DIR = path.join(UPLOADS_DIR, "resumes");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(RESUMES_DIR, { recursive: true });

app.use("/resumes", express.static(RESUMES_DIR));

const upload = multer({ dest: UPLOADS_DIR });

/* -------------------------------------------------- */
/* HELPERS */
/* -------------------------------------------------- */
const safeUnlink = (p) => p && fs.existsSync(p) && fs.unlinkSync(p);

async function parsePdf(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text || "";
  } catch {
    return "";
  }
}

function generatePdf(text, email) {
  return new Promise((resolve) => {
    const name = `${email.split("@")[0]}-${Date.now()}.pdf`;
    const filePath = path.join(RESUMES_DIR, name);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(fs.createWriteStream(filePath));
    doc.fontSize(11).text(text || " ");
    doc.end();

    resolve(name);
  });
}

/* -------------------------------------------------- */
/* AUTH (DEMO) */
/* -------------------------------------------------- */

app.post("/api/auth/register", async (req, res) => {
  const { fullName, email, password, role, company } = req.body;

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "User already exists" });
    }

    const user = await User.create({
      fullName,
      email,
      password,
      role,
      company,
      verificationStatus: role === "recruiter" ? "unverified" : "verified"
    });

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});
  
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json({
      user: {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        company: user.company,
        verificationStatus: user.verificationStatus
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});


app.post("/api/recruiter/request-verification", async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email, role: "recruiter" });

  if (!user) {
    return res.status(404).json({ error: "Recruiter not found" });
  }

  user.verificationStatus = "pending";
  await user.save();

  res.json({ message: "Verification request sent" });
});

app.post("/api/admin/verify-recruiter", async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  user.verificationStatus = "verified";
  await user.save();

  res.json({ message: "Recruiter verified ✅" });
});
  
/* -------------------------------------------------- */
/* JOB ROUTES */
/* -------------------------------------------------- */
app.post("/api/recruiter/jobs", async (req, res) => {
  const { recruiterEmail } = req.body;

  const user = users.find(u => u.email === recruiterEmail);

  if (!user || user.verificationStatus !== "verified") {
    return res.status(403).json({
      error: "Only verified recruiters can post jobs"
    });
  }

  const job = await Job.create(req.body);
  res.json(job);
});

app.get("/api/recruiter/profile", (req, res) => {
  const { email } = req.query;

  const user = users.find(u => u.email === email);

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    fullName: user.fullName,
    email: user.email,
    verificationStatus: user.verificationStatus
  });
});

app.get("/api/jobs", async (_, res) => {
  res.json(await Job.find().sort({ createdAt: -1 }));
});

// Recruiter: get applications grouped by job
app.get("/api/recruiter/applications", async (req, res) => {
  try {
    const { recruiterEmail } = req.query;

    if (!recruiterEmail) {
      return res.status(400).json({
        error: "recruiterEmail is required",
      });
    }

    const jobs = await Job.find({ recruiterEmail }).lean();

    const response = jobs.map((job) => ({
      jobId: job._id.toString(),
      jobTitle: job.title,
      applications: (job.applications || []).map((app) => ({
        candidateName: app.candidateName,
        candidateEmail: app.candidateEmail,
        atsScore: app.atsScore,
        resumeUrl: app.resumeUrl,
        resumeText: app.resumeText,
        appliedAt: app.appliedAt,
        notes: app.notes,
      })),
    }));

    // ✅ return MUST be inside this function
    res.json(response);
  } catch (err) {
    console.error("Recruiter applications error:", err);
    res.status(500).json({ error: "Failed to fetch applications." });
  }
});


/* -------------------------------------------------- */
/* APPLY TO JOB (🔥 RESUME PDF SAVED HERE) */
/* -------------------------------------------------- */
app.post("/api/jobs/:jobId/apply", async (req, res) => {
  const { candidateName, candidateEmail, atsScore, resumeText } = req.body;

  const job = await Job.findById(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  let resumeUrl = null;

  if (resumeText) {
    const pdfName = await generatePdf(resumeText, candidateEmail);
 resumeUrl = `${BASE_URL}/resumes/${pdfName}`;
  }

  job.applications.push({
    candidateName,
    candidateEmail,
    atsScore,
    resumeUrl,
    appliedAt: new Date(),
  });

  await job.save();
  res.json({ message: "Applied", resumeUrl });
});

/* -------------------------------------------------- */
/* PARSE RESUME (KEYWORDS) */
/* -------------------------------------------------- */
app.post("/api/parse", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file" });

  let text = "";
  if (file.originalname.endsWith(".pdf"))
    text = await parsePdf(fs.readFileSync(file.path));
  else if (file.originalname.endsWith(".docx"))
    text = (await mammoth.extractRawText({ path: file.path })).value || "";
  else text = fs.readFileSync(file.path, "utf8");

  safeUnlink(file.path);

  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const keywords = [...new Set(tokens)].slice(0, 20);

  res.json({
    text,
    keywords,
    skillsFound: keywords.slice(0, 10),
    topTokens: keywords,
  });
});

/* -------------------------------------------------- */
/* ANALYZE (ATS + AI FEEDBACK – SAFE MOCK) */
/* -------------------------------------------------- */
app.post("/api/analyze", async (req, res) => {
  const text = req.body.text || "";
  let atsScore = 40;
  if (text.length > 300) atsScore += 20;
  if (text.length > 700) atsScore += 20;

  res.json({
    atsScore,
    topSkills: ["JavaScript", "React", "Node.js"],
    suggestions: [
      "Add measurable achievements",
      "Improve summary section",
    ],
    rewrittenBullets: ["Improved backend performance by 35%"],
  });
});

/* -------------------------------------------------- */
/* RECRUITER: FETCH OWN JOB POSTS */
/* -------------------------------------------------- */
app.get("/api/recruiter/jobs", async (req, res) => {
  try {
    const { recruiterEmail } = req.query;

    if (!recruiterEmail) {
      return res.status(400).json({
        error: "recruiterEmail is required",
      });
    }

    const jobs = await Job.find({ recruiterEmail })
      .sort({ createdAt: -1 })
      .lean();

    res.json(jobs);
  } catch (err) {
    console.error("Recruiter jobs fetch error:", err);
    res.status(500).json({ error: "Failed to fetch recruiter jobs" });
  }
});

/* -------------------------------------------------- */
/* STATIC FRONTEND (RENDER FIX) */
/* -------------------------------------------------- */
const DIST = path.join(__dirname, "dist");

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));

  app.get("*", (req, res) => {
    // 🚫 DO NOT let React catch resume PDFs
    if (req.path.startsWith("/resumes")) {
      return res.status(404).end();
    }

    res.sendFile(path.join(DIST, "index.html"));
  });
}


/* -------------------------------------------------- */
/* START */
/* -------------------------------------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
