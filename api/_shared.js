import { GoogleGenerativeAI } from '@google/generative-ai'

export const MODEL_CHAIN = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
]

export const ASPECT_RATIOS = {
  'Instagram':  '4:5',
  'Facebook':   '1:1',
  'LinkedIn':   '1:1',
  'YouTube':    '16:9',
  'TikTok':     '9:16',
  'Google Ads': '1:1',
  'Twitter/X':  '16:9',
}

export const PLATFORM_DIMS = {
  'Instagram':  { w: 768,  h: 960  },
  'Facebook':   { w: 1024, h: 1024 },
  'LinkedIn':   { w: 1024, h: 1024 },
  'YouTube':    { w: 1280, h: 720  },
  'TikTok':     { w: 720,  h: 1280 },
  'Google Ads': { w: 1024, h: 1024 },
  'Twitter/X':  { w: 1280, h: 720  },
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

function isRetryable(err) {
  const msg = err?.message || ''
  return msg.includes('503') || msg.includes('Service Unavailable') ||
         msg.includes('429') || msg.includes('Too Many Requests') ||
         msg.includes('overloaded') || msg.includes('high demand')
}

export async function streamToResponse(res, contents) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let lastError = null

  for (const modelName of MODEL_CHAIN) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(3000)

      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { maxOutputTokens: 4096, temperature: 0.9 }
        })

        const result = await model.generateContentStream(contents)
        res.write(`data: ${JSON.stringify({ model: modelName })}\n\n`)

        for await (const chunk of result.stream) {
          try {
            const text = chunk.text()
            if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`)
          } catch (_) {}
        }

        res.write('data: [DONE]\n\n')
        res.end()
        return

      } catch (err) {
        lastError = err
        if (isRetryable(err) && attempt === 0) continue
        break
      }
    }
  }

  res.write(`data: ${JSON.stringify({ error: `All models unavailable. ${lastError?.message?.substring(0, 150)}` })}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

export function buildPrompt({ brandName, product, targetAudience, platform, objective }) {
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

export function buildScreenshotPrompt({ platform, objective }) {
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
