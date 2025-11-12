// server.js
// Express backend for AI Resume Analyzer

import express from 'express'
import multer from 'multer'
import pdf from 'pdf-parse'
import mammoth from 'mammoth'
import cors from 'cors'
import fs from 'fs'
import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const upload = multer({ dest: 'uploads/' })
const app = express()
app.use(cors())
app.use(express.json())

// Parse endpoint - extracts text from uploaded file
app.post('/api/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const { path, originalname, mimetype } = req.file
    let text = ''

    if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
      const buffer = fs.readFileSync(path)
      const data = await pdf(buffer)
      text = data.text
    } else if (originalname.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ path })
      text = result.value
    } else {
      text = fs.readFileSync(path, 'utf8')
    }

    fs.unlinkSync(path)
    res.json({ text })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to parse file' })
  }
})

// Analyze endpoint - sends resume text to AI provider
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  try {
    let text = ''

    if (req.file) {
      const { path, originalname, mimetype } = req.file
      if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
        const buffer = fs.readFileSync(path)
        text = (await pdf(buffer)).text
      } else if (originalname.endsWith('.docx')) {
        text = (await mammoth.extractRawText({ path })).value
      } else {
        text = fs.readFileSync(path, 'utf8')
      }
      fs.unlinkSync(path)
    } else if (req.body.text) {
      text = req.body.text
    } else {
      return res.status(400).json({ error: 'No file or text provided' })
    }

    // Prepare AI prompt
    const prompt = `You are an expert resume reviewer. Given the resume text delimited by triple backticks, return a JSON object with keys: atsScore (0-100), topSkills (array of strings), suggestions (array of strings), rewrittenBullets (array of strings, up to 6). Respond ONLY with valid JSON. Resume:\n\n\`\`\`\n${text.slice(0, 6000)}\n\`\`\``

    // If no API key, send mock data
    if (!process.env.OPENAI_API_KEY) {
      const mock = {
        atsScore: 85,
        topSkills: ['JavaScript', 'React', 'Node.js'],
        suggestions: [
          'Add quantifiable achievements to your experience.',
          'Improve formatting for ATS readability.',
          'Consider adding a professional summary section.'
        ],
        rewrittenBullets: [
          'Optimized website performance, reducing load time by 45%.',
          'Led a 5-member dev team to complete major updates 3 weeks early.'
        ]
      }
      return res.json(mock)
    }

    // Send prompt to OpenAI (or compatible provider)
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful resume analysis assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error('AI Error:', errorText)
      return res.status(500).json({ error: 'AI analysis failed' })
    }

    const aiJson = await aiResponse.json()
    const output = aiJson.choices?.[0]?.message?.content || ''

    try {
      const parsed = JSON.parse(output)
      res.json(parsed)
    } catch (parseError) {
      console.warn('AI output not JSON, returning raw text')
      res.json({ raw: output })
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server analysis error' })
  }
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`))
