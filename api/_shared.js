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
Think as a senior graphic designer and art director at a top agency. Write ONE ready-to-use image prompt for DALL-E 3 or Gemini. Natural language only — no special syntax, no asterisks, no brackets.

First decide the AD VISUAL FORMAT: is this (a) a lifestyle/human-led photograph, (b) a clean product-on-background studio shot, (c) a bold graphic/typographic design composition, or (d) an abstract concept visual? Choose what best fits the brand and platform.

Then write the prompt covering all of these in smooth, connected sentences:

COMPOSITION: Describe the exact visual layout — where the subject/product sits in the frame, amount of negative space, visual flow direction, foreground and background separation. Be specific: "centered hero product on lower third with generous empty space above for headline" or "full-bleed human subject from waist up, product held at chest height, right-side weighted composition."

SUBJECT & DETAIL: For people — exact appearance, skin tone, expression, clothing texture, pose energy. For products — exact angle (45°, flat lay, hero front-facing), surface material, props, context objects. Make it visual and specific.

DESIGN AESTHETIC & MOOD: Pick one and describe it fully — luxury minimalism / raw editorial / vibrant bold / cinematic drama / warm human / clinical premium / playful energetic.

COLOR STORY: Name the exact colors — primary background tone (e.g. "deep charcoal #1a1a1a"), accent color (e.g. "electric gold"), highlight (e.g. "warm cream white"). Describe how they create mood.

LIGHTING: Be precise — "large softbox from camera-left, subtle fill from right, warm rim light separating subject from background" or "harsh direct overhead light creating graphic shadows" or "backlit golden hour haze with lens flare".

END with this exact line: "No text, no typography, no watermarks in the image. Ultra high-end advertising visual, hyperrealistic, professional retouching, magazine cover quality."

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
Think as a senior graphic designer. Write ONE ready-to-use prompt for DALL-E 3 or Gemini. Natural language, no special syntax. Decide the best visual format for this product (studio shot / lifestyle / flat lay / 3D render style). Then describe: exact product angle and position in frame, surface/background (what material, color, texture), surrounding props or context that elevate it, lighting setup that makes this product irresistible (e.g. "single hard light from top-right casting a dramatic shadow to the left, with a subtle warm reflection on the surface"), exact color palette. End with: "No text or typography in the image. Hyperrealistic product advertising photography, razor-sharp product detail, aspirational and desirable, magazine quality."

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

export function buildCombinedPrompt({ types, platform, objective, brandName, product }) {
  const typeLabels = {
    logo: 'Brand Logo',
    reference: 'Reference Ad',
    product: 'Product Photo'
  }
  const imageList = types.map((t, i) => `Image ${i + 1} — ${typeLabels[t]}`).join('\n')

  const instructions = {
    logo: 'Analyze the brand logo: color palette, typography style, design language, brand personality it communicates, target audience it signals, and quality tier (budget/mid/premium/luxury).',
    reference: 'Analyze the reference ad: visual hierarchy, emotional hook, copy strategy, layout structure, color psychology, photography style, what makes it effective, and what could be improved.',
    product: 'Analyze the product: design quality, materials, color, perceived price point, unique visual appeal, and best angles/contexts for advertising.'
  }

  const analysisInstructions = types.map((t, i) =>
    `Image ${i + 1} (${typeLabels[t]}): ${instructions[t]}`
  ).join('\n\n')

  return `You are a world-class Creative Director, Brand Strategist, and Senior Graphic Designer.

You have been given ${types.length} reference image${types.length > 1 ? 's' : ''}:
${imageList}

Brand: ${brandName || 'Infer from images'}
Product/Service: ${product || 'Infer from images'}
Platform: ${platform || 'Instagram'}
Objective: ${objective || 'Conversions'}

STEP 1 — ANALYZE EACH IMAGE:
${analysisInstructions}

STEP 2 — SYNTHESIZE: Combine all visual inputs into one cohesive creative strategy. The logo defines the brand DNA. The reference shows proven structure. The product is the hero.

Now generate the complete ad creative brief:

## Visual Analysis
Detailed breakdown of each uploaded image and the key insights extracted from each.

## Campaign Concept
A campaign concept that integrates all visual inputs — brand-consistent, structurally strong, product-forward.

## Ad Headlines
5 headlines numbered 1–5.

## Ad Copy
3 copy options numbered 1–3.

## CTA Options
5 CTAs numbered 1–5.

## Visual Direction
Art direction that synthesizes the brand logo's identity, the reference ad's proven structure, and the product's visual appeal.

## Creative Layout Structure
Top / Middle / Bottom breakdown informed by the reference ad's best structural elements.

## AI Image Generation Prompt
Think as a senior graphic designer. Write ONE ready-to-use prompt for DALL-E 3 or Gemini. Natural language only. Incorporate the brand's color palette from the logo, the composition style from the reference, and the product prominently. Describe: visual format, exact composition and layout, subject/product details and placement, background and environment, lighting setup with precision, color story referencing the brand colors. End with: "No text or typography in the image. Hyperrealistic advertising visual, professional retouching, magazine quality."

## Color Palette
4–5 hex colors drawn from the uploaded brand assets.

## Font Recommendations
Fonts that match the brand logo's typographic personality.

## Designer Notes
5 production notes on how to execute this multi-asset campaign cohesively.

## Creative Variations

### Luxury Version
Premium version using the brand identity at its most elevated.

### Modern Minimal Version
Clean, design-forward execution of the brand assets.

### High Conversion Sales Version
Direct response version — product hero, strong CTA, conversion-optimized.

Agency-grade output synthesizing all provided brand assets.`
}
