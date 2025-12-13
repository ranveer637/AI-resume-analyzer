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
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
});
app.use(limiter);

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

// -------- Upload directories (FIXED) --------
const UPLOADS_DIR = path.join(__dirname, "uploads");
const RESUMES_DIR = path.join(UPLOADS_DIR, "resumes");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(RESUMES_DIR)) {
  fs.mkdirSync(RESUMES_DIR, { recursive: true });
}

const upload = multer({ dest: UPLOADS_DIR });

app.use("/resumes", express.static(RESUMES_DIR));

// -------- Helpers --------
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

// -------- PDF generation --------
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

// -------- Apply to Job (PDF SAVED) --------
app.post("/api/jobs/:jobId/apply", upload.single("file"), async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });

    let resumeText = req.body.resumeText || "";
    let resumeFilename;

    if (req.file) {
      const ext = req.file.originalname.toLowerCase();
      if (ext.endsWith(".pdf")) {
        resumeFilename = `${Date.now()}-${req.file.originalname}`;
        fs.renameSync(req.file.path, path.join(RESUMES_DIR, resumeFilename));
      } else {
        if (ext.endsWith(".docx")) {
          resumeText = (await mammoth.extractRawText({ path: req.file.path })).value;
        } else {
          resumeText = fs.readFileSync(req.file.path, "utf8");
        }
        resumeFilename = await generatePdfFromText(resumeText);
        safeUnlink(req.file.path);
      }
    } else if (resumeText) {
      resumeFilename = await generatePdfFromText(resumeText);
    }

    const resumeUrl = resumeFilename
      ? `${req.protocol}://${req.get("host")}/resumes/${resumeFilename}`
      : null;

    job.applications.push({
      candidateName: req.body.candidateName,
      candidateEmail: req.body.candidateEmail,
      atsScore: req.body.atsScore,
      notes: req.body.notes,
      resumeUrl,
      resumeText,
    });

    await job.save();
    res.json({ message: "Application submitted", resumeUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Apply failed" });
  }
});

// -------- Recruiter view applications --------
app.get("/api/recruiter/applications", async (req, res) => {
  const jobs = await Job.find({ recruiterEmail: req.query.recruiterEmail });
  res.json(jobs);
});

// -------- Health --------
app.get("/healthz", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
