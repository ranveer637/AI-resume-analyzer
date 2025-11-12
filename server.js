// server.js
// Express backend for AI Resume Analyzer (ES module style)

import express from "express";
import multer from "multer";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import cors from "cors";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" })); // small JSON bodies
app.use(express.urlencoded({ extended: true }));

// Multer config: temp uploads folder, 5 MB limit
const upload = multer({
  dest: path.join(__dirname, "uploads/"),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// Utility: safely read & remove uploaded file
async function readAndRemoveFile(filePath, encoding = null) {
  try {
    const content = encoding ? fs.readFileSync(filePath, encoding) : fs.readFileSync(filePath);
    fs.unlinkSync(filePath);
    return content;
  } catch (err) {
    // Attempt to unlink if exists
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    throw err;
  }
}

// API: parse uploaded file and return extracted text
app.post("/api/parse", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { path: fp, originalname, mimetype } = req.file;
    let text = "";

    if (mimetype === "application/pdf" || originalname.toLowerCase().endsWith(".pdf")) {
      const buffer = fs.readFileSync(fp);
      const data = await pdf(buffer);
      text = data.text || "";
      fs.unlinkSync(fp);
    } else if (originalname.toLowerCase().endsWith(".docx")) {
      const result = await mammoth.extractRawText({ path: fp });
      text = result.value || "";
      fs.unlinkSync(fp);
    } else {
      // treat as text file
      text = await readAndRemoveFile(fp, "utf8");
    }

    return res.json({ text });
  } catch (err) {
    console.error("Parse error:", err);
    return res.status(500).json({ error: "Failed to parse file" });
  }
});

// Helper: try to extract JSON from text robustly
function extractJsonFromText(text) {
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch {}

  // Attempt to locate the first { ... } block
  const firstCurly = text.indexOf("{");
  const lastCurly = text.lastIndexOf("}");
  if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
    const candidate = text.slice(firstCurly, lastCurly + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  // Try to find a JSON array if the assistant returned an array
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const candidate = text.slice(firstBracket, lastBracket + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  // Couldn't parse JSON
  return null;
}

// API: analyze resume (file upload OR text body)
app.post("/api/analyze", upload.single("file"), async (req, res) => {
  let filePath;
  try {
    let text = "";

    if (req.file) {
      filePath = req.file.path;
      const { originalname, mimetype } = req.file;

      if (mimetype === "application/pdf" || originalname.toLowerCase().endsWith(".pdf")) {
        const buffer = fs.readFileSync(filePath);
        text = (await pdf(buffer)).text || "";
        fs.unlinkSync(filePath);
      } else if (originalname.toLowerCase().endsWith(".docx")) {
        text = (await mammoth.extractRawText({ path: filePath })).value || "";
        fs.unlinkSync(filePath);
      } else {
        text = await readAndRemoveFile(filePath, "utf8");
      }
    } else if (req.body.text) {
      text = req.body.text;
    } else {
      return res.status(400).json({ error: "No file or text provided" });
    }

    // Build the prompt for the AI
    const prompt = `You are an expert resume reviewer. Given the resume text delimited by triple backticks, return a JSON object with keys: 
- atsScore (integer 0-100), 
- topSkills (array of strings), 
- suggestions (array of strings), 
- rewrittenBullets (array of strings, up to 6). 
Respond ONLY with valid JSON. Resume:

\`\`\`
${text.slice(0, 6000)}
\`\`\``;

    // If no API key, return mock data (useful for local dev / testing)
    if (!process.env.OPENAI_API_KEY) {
      const mock = {
        atsScore: 85,
        topSkills: ["JavaScript", "React", "Node.js"],
        suggestions: [
          "Add quantifiable achievements to your experience.",
          "Ensure skills are in a dedicated section near the top.",
          "Use bullet points with strong action verbs."
        ],
        rewrittenBullets: [
          "Optimized page load time by 45% through code-splitting and lazy loading.",
          "Led a 4-person team to deliver major feature two sprints early."
        ]
      };
      return res.json(mock);
    }

    // Call OpenAI Chat Completions (adjust model / endpoint as needed)
    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // change model if desired
        messages: [
          { role: "system", content: "You are a helpful resume analysis assistant." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 900,
      }),
    });

    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      console.error("OpenAI error:", errTxt);
      return res.status(502).json({ error: "AI provider returned an error" });
    }

    const aiJson = await apiRes.json();
    const assistantMessage = aiJson.choices?.[0]?.message?.content || aiJson.choices?.[0]?.text || "";

    // Try to parse JSON strictly; otherwise try to extract JSON chunk; otherwise return raw text.
    const parsed = extractJsonFromText(assistantMessage);
    if (parsed) {
      return res.json(parsed);
    } else {
      // If the assistant didn't return JSON, return raw text so frontend can still show it
      return res.json({ raw: assistantMessage });
    }
  } catch (err) {
    console.error("Analyze error:", err);
    // Clean up any leftover uploaded file
    try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    return res.status(500).json({ error: "Analysis failed" });
  }
});

// Serve frontend build (Vite's `dist` folder)
const DIST_DIR = path.join(__dirname, "dist");

// Serve static files if they exist
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));

  // Fallback: return index.html for client-side routing (except API routes)
  app.get("*", (req, res, next) => {
    // let API calls pass through
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
} else {
  console.warn("Warning: dist folder not found. Frontend won't be served by Express. Run `npm run build` to generate it.");
}

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT} (PORT=${PORT})`);
});
