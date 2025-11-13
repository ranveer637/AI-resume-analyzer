// server.js
// Express backend for AI Resume Analyzer (ES module style)
// Features:
// - dotenv config
// - multer uploads with size limit
// - PDF/DOCX/TXT parsing (pdf-parse, mammoth)
// - robust OpenAI call with JSON extraction fallback
// - OPENAI_MOCK support for safe local/testing mode
// - serves Vite `dist/` if present (for production single-repo deploys)
// - careful uploaded file cleanup and helpful error messages (temporary debug mode)

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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting (basic protection)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Multer config (uploads folder will be created automatically if necessary)
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

// Utility helpers
function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.warn("Failed to unlink file:", filePath, e?.message || e);
  }
}
async function readFileUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

// Try to robustly extract JSON from a text response
function extractJsonFromText(text) {
  if (!text || typeof text !== "string") return null;

  // Direct JSON parse
  try {
    return JSON.parse(text);
  } catch {}

  // Attempt to find first { ... } block
  const firstCurly = text.indexOf("{");
  const lastCurly = text.lastIndexOf("}");
  if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
    const candidate = text.slice(firstCurly, lastCurly + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  // Attempt to find first [ ... ] block
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const candidate = text.slice(firstBracket, lastBracket + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  return null;
}

// Parse endpoint
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
      const data = await pdf(buffer);
      text = data?.text || "";
    } else if (originalName.toLowerCase().endsWith(".docx")) {
      const result = await mammoth.extractRawText({ path: filePath });
      text = result?.value || "";
    } else {
      text = await readFileUtf8(filePath);
    }

    safeUnlink(filePath);
    return res.json({ text });
  } catch (err) {
    safeUnlink(filePath);
    console.error("Parse error:", err);
    return res.status(500).json({ error: "Failed to parse file", message: err?.message || String(err) });
  }
});

// Analyze endpoint
app.post("/api/analyze", upload.single("file"), async (req, res) => {
  let filePath;
  try {
    let text = "";

    // 1) Obtain text from upload or raw body
    if (req.file) {
      filePath = req.file.path;
      const originalName = req.file.originalname || "";
      const mimetype = req.file.mimetype || "";

      if (mimetype === "application/pdf" || originalName.toLowerCase().endsWith(".pdf")) {
        const buffer = fs.readFileSync(filePath);
        text = (await pdf(buffer)).text || "";
      } else if (originalName.toLowerCase().endsWith(".docx")) {
        text = (await mammoth.extractRawText({ path: filePath })).value || "";
      } else {
        text = await readFileUtf8(filePath);
      }
      safeUnlink(filePath);
    } else if (req.body.text) {
      text = String(req.body.text);
    } else {
      return res.status(400).json({ error: "No file or text provided" });
    }

    // 2) Basic sanity checks
    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: "Parsed text is empty or too short", parsedLength: text?.length || 0 });
    }

    // 3) Mock fallback (useful for testing / if key not set)
    const USE_MOCK = process.env.OPENAI_MOCK === "true" || !process.env.OPENAI_API_KEY;
    if (USE_MOCK) {
      const mock = {
        atsScore: 82,
        topSkills: ["JavaScript", "React", "Node.js"],
        suggestions: [
          "Add measurable metrics to achievements.",
          "Move skills to a prominent top section.",
          "Use action verbs in bullet points."
        ],
        rewrittenBullets: [
          "Optimized page load time by 40% by introducing code-splitting and lazy-loading.",
          "Led a 3-person team to deliver a major feature two sprints early."
        ]
      };
      return res.json(mock);
    }

    // 4) Build an instruction prompt (keep concise & strict to JSON output)
    const prompt = `You are an expert resume reviewer. Given the resume text between triple backticks, return ONLY valid JSON with keys:
- atsScore (integer 0-100),
- topSkills (array of strings),
- suggestions (array of strings),
- rewrittenBullets (array of strings, up to 6).

Resume:
\`\`\`
${text.slice(0, 6000)}
\`\`\``;

    // 5) Call OpenAI Chat Completions (Chat API)
    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful resume reviewer that outputs only strict JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 900,
      }),
    });

    const rawText = await apiRes.text();

    if (!apiRes.ok) {
      console.error("OpenAI non-OK:", apiRes.status, rawText);
      return res.status(502).json({ error: "AI provider returned an error", status: apiRes.status, details: rawText });
    }

    // 6) Try to parse JSON strictly or via extraction
    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      parsed = extractJsonFromText(rawText);
    }

    if (!parsed) {
      console.warn("AI returned non-JSON. Returning raw text for debugging.");
      // Return rawText so frontend can display it; frontend should show to developer
      return res.status(200).json({ raw: rawText });
    }

    return res.json(parsed);
  } catch (err) {
    console.error("Analyze error:", err);
    safeUnlink(filePath);
    return res.status(500).json({ error: "Analysis failed", message: err?.message || String(err) });
  }
});

// Serve frontend build (dist) if present
const DIST_DIR = path.join(__dirname, "dist");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // All non-API GETs serve the SPA
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
} else {
  console.warn("dist folder not found — static frontend will not be served by Express. Run `npm run build` to generate it.");
}

// Health check
app.get("/healthz", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT} (PORT=${PORT})`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not set. The server will run in mock mode. Set OPENAI_API_KEY in env to enable real AI calls.");
  }
});
