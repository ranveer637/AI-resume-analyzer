// server.js
// Robust Express backend for AI Resume Analyzer
// - File upload & parsing (PDF/DOCX/TXT)
// - Keyword extraction (local, no extra deps)
// - OpenAI call with retries & exponential backoff
// - Guaranteed atsScore (0–100) using AI or heuristic fallback
// - Mock mode via OPENAI_MOCK
// - Rate limiting via express-rate-limit
// - Serves Vite dist/ build in production

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
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// -------- Rate limiting --------
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // per-IP per minute
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// -------- Uploads directory --------
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

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
].map(s => s.toLowerCase());

function tokenizeForKeywords(text) {
  return text
    .replace(/[\u2012\u2013\u2014]/g, "-") // normalize dashes
    .replace(/[^\w\- ]+/g, " ")           // keep letters, numbers, underscore, dash, space
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
    .map(x => x[0]);

  const topTokens = topFrequent.map(x => x.token);
  const combined = [...skillList, ...topTokens].filter((v, i, a) => a.indexOf(v) === i);

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

  // clamp between 30 and 95
  if (score < 30) score = 30;
  if (score > 95) score = 95;

  return score;
}

// -------- Helpers --------
function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
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

  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(text.slice(firstBracket, lastBracket + 1));
    } catch {}
  }

  return null;
}

// -------- OpenAI with retries --------
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

      // Retry only on 429 or 5xx
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

// -------- /api/parse: text + keywords --------
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
      text = readFileUtf8(filePath);
    }

    safeUnlink(filePath);

    if (!text || text.trim().length === 0) {
      return res.status(200).json({
        text: "",
        keywords: [],
        skillsFound: [],
        topTokens: [],
        message: "No extractable text (maybe scanned PDF?)",
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

// -------- /api/analyze: OpenAI + keywords + atsScore --------
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
        text = (await pdf(buffer)).text || "";
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

    // Local keyword extraction
    const kw = extractKeywords(text);

    // Mock mode: skip OpenAI entirely
    const USE_MOCK = process.env.OPENAI_MOCK === "true" || !process.env.OPENAI_API_KEY;
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

    // Build prompt for AI
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
        { role: "system", content: "You are a helpful resume reviewer that outputs strict JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 700,
    };

    const openaiResult = await callOpenAIWithRetries(payload, 5, 800);

    if (!openaiResult.ok) {
      console.error("OpenAI call failed after retries:", openaiResult);

      // Non-retryable error (401, 403, etc.)
      if (openaiResult.status && openaiResult.status !== 429) {
        return res.status(502).json({
          error: "AI provider returned an error",
          status: openaiResult.status,
          details: openaiResult.text,
        });
      }

      // Rate limited or exhausted retries: return graceful fallback
      return res.status(200).json({
        error: "AI provider rate-limited or unavailable. Returning keyword-only analysis.",
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
      // Could not parse JSON, return raw AI text + local keywords + estimated ATS
      return res.status(200).json({
        raw: rawText,
        atsScore: estimateAtsScoreFromText(text, kw),
        keywords: kw.keywords,
        skillsFound: kw.skillsFound,
        topTokens: kw.topTokens,
      });
    }

    // Ensure keyword fields exist
    if (!parsed.keywords) parsed.keywords = kw.keywords;
    if (!parsed.skillsFound) parsed.skillsFound = kw.skillsFound;
    if (!parsed.topTokens) parsed.topTokens = kw.topTokens;

    // Ensure atsScore is always a valid number 0–100
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

// -------- Serve frontend build (Vite dist) --------
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

// -------- Health check --------
app.get("/healthz", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// -------- Start server --------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on PORT=${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not set — server will run in mock mode unless you set it.");
  }
});
