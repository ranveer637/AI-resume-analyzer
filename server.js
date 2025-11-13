// server.js
// Robust Express backend for AI Resume Analyzer
// - dotenv config
// - multer uploads with size limit
// - PDF/DOCX/TXT parsing (pdf-parse, mammoth)
// - keyword extraction (local, no extra deps)
// - OpenAI call with retries & exponential backoff + graceful fallback
// - OPENAI_MOCK support for safe testing
// - rate limiting via express-rate-limit
// - serves Vite `dist/` if present
//
// IMPORTANT: add OPENAI_API_KEY in your Render / environment variables.
// If OPENAI_MOCK=true is set, the server returns mock analysis.

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

// Rate limiting (basic protection)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Uploads directory
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB limit
});

// ---------------------------
// Keyword extraction helpers
// ---------------------------
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

  const freqEntries = Array.from(freq.entries()).sort((a,b) => b[1]-a[1]);

  const foundSkills = new Map();
  const words = tokens;
  for (let i=0;i<words.length;i++){
    for (let n=1;n<=3 && i+n<=words.length;n++){
      const phrase = words.slice(i,i+n).join(" ");
      if (phrase.length < 2) continue;
      if (SKILLS_LIST.includes(phrase)) {
        foundSkills.set(phrase, (foundSkills.get(phrase) || 0) + 1);
      }
    }
  }

  const topFrequent = [];
  const maxFreqTokens = opts.maxFreqTokens || 12;
  for (const [token,count] of freqEntries) {
    if (foundSkills.has(token)) continue;
    if (token.length <= 2) continue;
    topFrequent.push({ token, count });
    if (topFrequent.length >= maxFreqTokens) break;
  }

  const skillList = Array.from(foundSkills.entries())
    .sort((a,b) => b[1] - a[1])
    .map(x => x[0]);

  const topTokens = topFrequent.map(x => x.token);
  const combined = [...skillList, ...topTokens].filter((v, i, a) => a.indexOf(v) === i);

  return {
    keywords: combined.slice(0, 30),
    skillsFound: skillList,
    topTokens: topTokens.slice(0, 30)
  };
}

// ---------------------------
// File helpers & JSON extractor
// ---------------------------
function safeUnlink(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
}
function readFileUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}
function extractJsonFromText(text) {
  if (!text || typeof text !== "string") return null;
  try { return JSON.parse(text); } catch {}
  const firstCurly = text.indexOf("{");
  const lastCurly = text.lastIndexOf("}");
  if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
    try { return JSON.parse(text.slice(firstCurly, lastCurly+1)); } catch {}
  }
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try { return JSON.parse(text.slice(firstBracket, lastBracket+1)); } catch {}
  }
  return null;
}

// ---------------------------
// OpenAI call with retries/backoff
// ---------------------------
async function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

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

      if (resp.ok) return { ok: true, text: txt, status: resp.status };
      lastErrText = `status=${resp.status} body=${txt}`;

      // If non-retryable, return immediately
      if (![429].includes(resp.status) && !(resp.status >=500 && resp.status <600)) {
        return { ok: false, text: txt, status: resp.status };
      }
      // else retry
    } catch (err) {
      lastErrText = String(err?.message || err);
    }

    const delay = Math.floor(baseDelay * Math.pow(2, i) + Math.random() * 300);
    console.warn(`OpenAI request failed (attempt ${i+1}/${attempts}). Retrying in ${delay}ms. Last error: ${lastErrText}`);
    await sleep(delay);
  }
  return { ok: false, text: lastErrText || "exhausted retries", status: 429 };
}

// ---------------------------
// /api/parse - extract text + keywords
// ---------------------------
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
      return res.status(200).json({ text: "", keywords: [], skillsFound: [], topTokens: [], message: "No extractable text (maybe scanned PDF?)" });
    }

    const kw = extractKeywords(text);
    return res.json({ text, keywords: kw.keywords, skillsFound: kw.skillsFound, topTokens: kw.topTokens });
  } catch (err) {
    safeUnlink(filePath);
    console.error("Parse error:", err);
    return res.status(500).json({ error: "Failed to parse file", message: err?.message || String(err) });
  }
});

// ---------------------------
// /api/analyze - OpenAI + keywords (with retries + fallback)
// ---------------------------
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
      return res.status(400).json({ error: "Parsed text is empty or too short", parsedLength: text?.length || 0 });
    }

    // Local keywords
    const kw = extractKeywords(text);

    // Mock fallback (if set or key missing)
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
        ],
        keywords: kw.keywords,
        skillsFound: kw.skillsFound,
        topTokens: kw.topTokens
      };
      return res.json(mock);
    }

    // Prepare prompt
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
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 700
    };

    // Call OpenAI with retries/backoff
    const openaiResult = await callOpenAIWithRetries(payload, 5, 800);

    if (!openaiResult.ok) {
      console.error("OpenAI call failed after retries:", openaiResult);
      // If non-retryable error (401, etc.), return it
      if (openaiResult.status && openaiResult.status !== 429) {
        return res.status(502).json({ error: "AI provider returned an error", status: openaiResult.status, details: openaiResult.text });
      }

      // Rate-limited or retries exhausted: return graceful fallback (keywords only)
      return res.status(200).json({
        error: "AI provider rate-limited or unavailable. Returning keyword-only analysis.",
        details: openaiResult.text,
        keywords: kw.keywords,
        skillsFound: kw.skillsFound,
        topTokens: kw.topTokens
      });
    }

    // Parse raw assistant reply
    const rawText = openaiResult.text;
    let parsed = null;
    try { parsed = JSON.parse(rawText); } catch (e) { parsed = extractJsonFromText(rawText); }

    if (!parsed) {
      // Return AI raw text + local keywords for debugging / partial result
      return res.status(200).json({ raw: rawText, keywords: kw.keywords, skillsFound: kw.skillsFound, topTokens: kw.topTokens });
    }

    // Ensure keywords exist
    if (!parsed.keywords) parsed.keywords = kw.keywords;
    if (!parsed.skillsFound) parsed.skillsFound = kw.skillsFound;
    if (!parsed.topTokens) parsed.topTokens = kw.topTokens;

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
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
} else {
  console.warn("dist folder not found — run `npm run build` to generate it.");
}

// Health check
app.get("/healthz", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on PORT=${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not set — server will run in mock mode unless you set it.");
  }
});
