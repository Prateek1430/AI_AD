import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleGenAI } from '@google/genai'
import multer from 'multer'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }))

const genAI     = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) // text + streaming
const imagenAI  = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY }) // image generation
const upload    = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// Platform → aspect ratio map
const ASPECT_RATIOS = {
  'Instagram':  '4:5',
  'Facebook':   '1:1',
  'LinkedIn':   '1:1',
  'YouTube':    '16:9',
  'TikTok':     '9:16',
  'Google Ads': '1:1',
  'Twitter/X':  '16:9',
}

// ─── Model fallback chain ─────────────────────────────────────────────────────
// If primary model returns 503/429/404, next model is tried automatically.
const PRIMARY = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
const MODEL_CHAIN = [...new Set([
  PRIMARY,
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
])]

const sleep = ms => new Promise(r => setTimeout(r, ms))

function isRetryable(err) {
  const msg = err?.message || ''
  return msg.includes('503') || msg.includes('Service Unavailable') ||
         msg.includes('429') || msg.includes('Too Many Requests') ||
         msg.includes('overloaded') || msg.includes('high demand')
}

function isSkippable(err) {
  const msg = err?.message || ''
  return isRetryable(msg) || msg.includes('404') || msg.includes('Not Found')
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildPrompt({ brandName, product, targetAudience, platform, objective }) {
  return `You are a world-class Creative Director, Performance Marketer, Art Director and Senior Graphic Designer at a top-tier advertising agency (Ogilvy, Wieden+Kennedy, BBDO level).

Create a complete, high-converting ad creative brief for:

Brand Name: ${brandName}
Product/Service: ${product}
Target Audience: ${targetAudience || 'Intelligently infer from the brand name and product'}
Platform: ${platform}
Objective: ${objective}

If industry, tone, colors, competitors, or budget are not specified — infer them intelligently from the brand and product. Do not ask for clarification.

Output the complete brief using these exact section headers:

## Campaign Concept
A powerful overarching campaign concept with a memorable tagline. Explain the strategic insight and emotional hook behind it.

## Ad Headlines
5 headline options, numbered 1–5. Punchy, platform-optimized, and conversion-focused.

## Ad Copy
3 ready-to-use ad copy options, numbered 1–3 (2–4 sentences each). Emotionally resonant and action-driving.

## CTA Options
5 strong call-to-action options, numbered 1–5.

## Visual Direction
Detailed art direction: mood, imagery, photography or illustration style, lighting, composition, color atmosphere. Be specific and evocative — write as if briefing a photographer.

## Creative Layout Structure
Exact layout with Top / Middle / Bottom breakdown. Include element placement, visual hierarchy, and spacing philosophy.

## AI Image Generation Prompt
One complete, ready-to-paste prompt for Midjourney or DALL-E 3. Include subject, style, lighting, composition, camera details, and quality modifiers (e.g. --ar 4:5 --q 2).

## Color Palette
4–5 colors with exact hex codes. State each color's role and the emotion it drives.

## Font Recommendations
Primary, Secondary, and Accent fonts. Explain how each ties to the brand personality.

## Designer Notes
5 specific production notes covering: platform spec, accessibility, motion/animation potential, print adaptation, and one unconventional creative risk worth taking.

## Creative Variations

### Luxury Version
Full concept for premium/luxury positioning — art direction, headline, copy, visual feel, and why it works for an affluent audience.

### Modern Minimal Version
Full concept for a clean, contemporary, design-forward aesthetic — art direction, headline, copy, visual feel.

### High Conversion Sales Version
Full concept optimized for direct response — aggressive CTA, urgency triggers, social proof placement, performance-first approach.

Write as if billing $500/hour. Be specific, bold, and commercially brilliant.`
}

function buildScreenshotPrompt({ platform, objective }) {
  return `You are a world-class Creative Director analyzing a competitor or reference ad creative.

Analyze this ad thoroughly, then generate a fresh creative brief inspired by its structure and effectiveness — with a completely original concept.

Platform: ${platform || 'Instagram'}
Objective: ${objective || 'Conversions'}

## Ad Analysis
Break down what's working: visual hierarchy, emotional hook, copy strategy, CTA placement, color psychology. Include an effectiveness score (1–10 with reasoning).

## Campaign Concept
Fresh, original campaign concept inspired by the structural strengths of this reference.

## Ad Headlines
5 headline options, numbered 1–5.

## Ad Copy
3 ready-to-use copy options, numbered 1–3.

## CTA Options
5 CTA options, numbered 1–5.

## Visual Direction
New art direction that matches or exceeds the reference ad's production quality.

## Creative Layout Structure
Layout structure mirroring what works in the reference (Top / Middle / Bottom).

## AI Image Generation Prompt
Complete Midjourney / DALL-E 3 prompt, ready to use.

## Color Palette
4–5 hex colors with roles and emotional purpose.

## Font Recommendations
Primary, Secondary, Accent — with brand rationale.

## Designer Notes
5 production notes including what to replicate from the reference and what to improve.

## Creative Variations

### Luxury Version
Premium positioning version.

### Modern Minimal Version
Clean, contemporary version.

### High Conversion Sales Version
Direct response optimized version.

Agency-grade output only.`
}

// ─── Core streaming with fallback + retry ─────────────────────────────────────

async function streamToResponse(res, contents) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let lastError = null

  for (const modelName of MODEL_CHAIN) {
    // Each model gets up to 2 attempts (immediate + 1 retry after delay)
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        console.log(`[retry] ${modelName} attempt ${attempt + 1} — waiting 3s...`)
        await sleep(3000)
      }

      try {
        console.log(`[model] trying ${modelName}...`)

        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { maxOutputTokens: 4096, temperature: 0.9 }
        })

        const result = await model.generateContentStream(contents)

        // Signal to frontend which model is active
        res.write(`data: ${JSON.stringify({ model: modelName })}\n\n`)

        for await (const chunk of result.stream) {
          try {
            const text = chunk.text()
            if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`)
          } catch (_) {
            // skip thinking/metadata chunks from newer models
          }
        }

        res.write('data: [DONE]\n\n')
        res.end()
        console.log(`[success] completed with ${modelName}`)
        return

      } catch (err) {
        lastError = err
        console.error(`[error] ${modelName} attempt ${attempt + 1}:`, err.message?.substring(0, 120))

        if (isRetryable(err) && attempt === 0) {
          continue // retry same model once
        }

        break // move to next model
      }
    }
  }

  // All models in the chain exhausted
  console.error('[fatal] all models failed. Last error:', lastError?.message)
  res.write(`data: ${JSON.stringify({
    error: `All models temporarily unavailable. Please try again in a minute.\n\nTried: ${MODEL_CHAIN.join(' → ')}`
  })}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.post('/api/generate', async (req, res) => {
  const { brandName, product, targetAudience, platform, objective } = req.body
  if (!brandName || !product || !platform || !objective) {
    return res.status(400).json({ error: 'Missing required fields: brandName, product, platform, objective' })
  }
  await streamToResponse(res, buildPrompt({ brandName, product, targetAudience, platform, objective }))
})

app.post('/api/analyze-screenshot', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' })

  const { platform, objective } = req.body
  const base64 = req.file.buffer.toString('base64')
  const mediaType = req.file.mimetype

  await streamToResponse(res, [
    { text: buildScreenshotPrompt({ platform, objective }) },
    { inlineData: { data: base64, mimeType: mediaType } }
  ])
})

// ─── Image Generation via Pollinations.ai ────────────────────────────────────
// Free, no API key required. Uses Flux model. Returns a direct image URL.

const PLATFORM_DIMS = {
  'Instagram':  { w: 768,  h: 960  },
  'Facebook':   { w: 1024, h: 1024 },
  'LinkedIn':   { w: 1024, h: 1024 },
  'YouTube':    { w: 1280, h: 720  },
  'TikTok':     { w: 720,  h: 1280 },
  'Google Ads': { w: 1024, h: 1024 },
  'Twitter/X':  { w: 1280, h: 720  },
}

app.post('/api/generate-image', (req, res) => {
  const { prompt, platform } = req.body
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' })

  const { w, h } = PLATFORM_DIMS[platform] || { w: 1024, h: 1024 }
  const seed = Math.floor(Math.random() * 999999)

  const imageUrl =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${w}&height=${h}&model=flux&nologo=true&enhance=true&seed=${seed}`

  console.log(`[image] Pollinations URL built — ${w}×${h} | platform: ${platform}`)

  res.json({
    imageUrl,
    model: 'Flux · Pollinations.ai',
    dimensions: `${w}×${h}`,
    aspectRatio: ASPECT_RATIOS[platform] || '1:1'
  })
})

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`\nServer ready at http://localhost:${PORT}`)
  console.log(`API Key : ${process.env.GOOGLE_API_KEY ? '✓ Loaded' : '✗ Missing'}`)
  console.log(`Model chain: ${MODEL_CHAIN.join(' → ')}\n`)
})
