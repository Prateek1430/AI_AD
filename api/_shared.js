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

  const errors = {}

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
        errors[modelName] = err.message?.match(/\[(\d+)[^\]]*\]/)?.[1] || err.message?.substring(0, 60)
        if (isRetryable(err) && attempt === 0) continue
        break
      }
    }
  }

  const summary = Object.entries(errors).map(([m, e]) => `${m}: ${e}`).join(' | ')
  res.write(`data: ${JSON.stringify({ error: `All models failed.\n${summary}` })}\n\n`)
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
Write a single ready-to-use prompt for DALL-E 3 or Gemini image generation (natural language, no special syntax or parameters). Think as a professional art director. Write in flowing descriptive sentences covering these 5 layers:

1. SUBJECT: Exactly who/what is in the frame — person's look, expression, pose, clothing, product placement
2. SCENE & BACKGROUND: Where it's set, what's around them, depth of environment
3. PHOTOGRAPHY STYLE: e.g. "ultra-realistic luxury commercial photography" / "high-end lifestyle editorial" / "cinematic product still" — and camera feel (sharp focus, shallow depth of field, etc.)
4. LIGHTING & MOOD: Exactly how it's lit — e.g. "soft diffused studio lighting with a warm backlight" / "golden hour sunlight streaming through glass" / "dramatic single-source hard light creating strong shadows"
5. COLOR & FINISH: Color palette feel — e.g. "warm amber and cream tones, rich contrast, film-like quality" / "cool muted tones, high-end minimalist look"

End the prompt with: "Professional advertising photography quality, sharp details, magazine-worthy composition, highly realistic."

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
Write a single ready-to-use prompt for DALL-E 3 or Gemini image generation — natural language, no special syntax. Inspired by the reference ad's visual strength but completely original. Cover: specific subject with detailed description, setting/background, photography style (ultra-realistic / editorial / cinematic), exact lighting setup, color tone and mood. End with: "Professional advertising photography quality, sharp details, magazine-worthy composition, highly realistic."

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

export function buildLogoPrompt({ platform, objective }) {
  return `You are a world-class Brand Strategist and Creative Director. A brand has shared their logo. Analyze it deeply and build a complete ad creative brief that is perfectly aligned with what this logo communicates.

Platform: ${platform || 'Instagram'}
Objective: ${objective || 'Conversions'}

## Logo Analysis
Analyze the logo: design style, color psychology, typography personality, what industry and audience it signals, brand positioning it implies (premium / playful / corporate / bold / minimal), and overall brand energy. Rate brand strength 1–10.

## Campaign Concept
A campaign concept that feels like a natural extension of this logo's identity and brand promise.

## Ad Headlines
5 headlines numbered 1–5. Must feel tonally consistent with the brand logo's personality.

## Ad Copy
3 copy options numbered 1–3. Voice and tone must match what the logo communicates.

## CTA Options
5 CTAs numbered 1–5.

## Visual Direction
Art direction that complements the logo — colors, photography style, layout philosophy, how the logo integrates into the creative.

## Creative Layout Structure
Top / Middle / Bottom breakdown with logo placement strategy.

## AI Image Generation Prompt
Write a single ready-to-use prompt for DALL-E 3 or Gemini — natural language, no special syntax. The visual should feel like it belongs in the same brand universe as this logo. Cover: subject, setting, photography style, lighting, color palette that complements the logo's colors. End with: "Professional advertising photography quality, sharp details, magazine-worthy composition, highly realistic."

## Color Palette
4–5 hex colors extracted or inspired by the logo palette, with emotional roles.

## Font Recommendations
Fonts that pair naturally with this logo's typography DNA.

## Designer Notes
5 notes on how to maintain brand consistency with this logo across ads.

## Creative Variations

### Luxury Version
Premium brand positioning version aligned with logo identity.

### Modern Minimal Version
Clean execution that lets the logo breathe.

### High Conversion Sales Version
Direct response version with strong CTA, brand-consistent.

Agency-grade brand-aligned output only.`
}

export function buildProductPrompt({ platform, objective }) {
  return `You are a world-class Creative Director and Performance Marketer. A brand has shared a product photo. Build a high-converting ad creative brief centered around this specific product.

Platform: ${platform || 'Instagram'}
Objective: ${objective || 'Conversions'}

## Product Analysis
Analyze the product: what it is, its design quality, materials, color, perceived price point, likely use case, who would buy it, and what emotional need it fulfills. Identify the strongest visual selling point.

## Campaign Concept
A campaign concept that makes this product the hero — a concept that makes people stop scrolling and want it.

## Ad Headlines
5 product-focused headlines numbered 1–5. Feature-benefit driven, emotionally resonant.

## Ad Copy
3 copy options numbered 1–3. Each must make the product feel desirable and worth buying now.

## CTA Options
5 CTAs numbered 1–5. Purchase/conversion focused.

## Visual Direction
How to shoot this product at its absolute best — angles, surfaces, props, context, lifestyle or pure product shot, hero composition.

## Creative Layout Structure
Top / Middle / Bottom with product placement as the hero element.

## AI Image Generation Prompt
Write a single ready-to-use prompt for DALL-E 3 or Gemini — natural language, no special syntax. Make the product look incredibly desirable. Cover: product placement, surrounding environment/props, photography style (luxury product photography / lifestyle / flat lay / editorial), exact lighting to make the product shine, color mood. End with: "Professional product advertising photography, ultra-sharp product detail, magazine-worthy composition, highly realistic and aspirational."

## Color Palette
4–5 hex colors derived from the product's color story.

## Font Recommendations
Fonts that complement the product's aesthetic positioning.

## Designer Notes
5 production notes on how to shoot and style this product for maximum conversion.

## Creative Variations

### Luxury Version
Make the product look like a premium, coveted object.

### Modern Minimal Version
Clean product-hero composition, white space, elegant.

### High Conversion Sales Version
Urgency, social proof, price-value communication — buy now energy.

Agency-grade product-focused output only.`
}
