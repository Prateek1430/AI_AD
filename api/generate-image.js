import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { ASPECT_RATIOS, PLATFORM_DIMS } from './_shared.js'

const DALLE_SIZES = {
  'Instagram':  '1024x1024',
  'Facebook':   '1024x1024',
  'LinkedIn':   '1024x1024',
  'YouTube':    '1792x1024',
  'TikTok':     '1024x1792',
  'Google Ads': '1024x1024',
  'Twitter/X':  '1792x1024',
}

// ─── Cloudflare Workers AI ────────────────────────────────────────────────────
// Free tier: 10,000 neurons/day — no credit card needed
// Models: FLUX.1-schnell (fast), SDXL, DreamShaper

const CF_MODELS = [
  '@cf/black-forest-labs/flux-1-schnell',
  '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  '@cf/lykon/dreamshaper-8-lcm',
]

async function tryCloudflare(prompt) {
  if (!process.env.CF_ACCOUNT_ID || !process.env.CF_API_TOKEN) return null

  for (const model of CF_MODELS) {
    try {
      console.log(`[cloudflare] trying ${model}...`)
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt }),
        }
      )

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`HTTP ${response.status}: ${err.substring(0, 100)}`)
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg'

      // CF returns binary image directly
      const buffer = Buffer.from(await response.arrayBuffer())
      console.log(`[cloudflare] success — ${model} (${buffer.length} bytes)`)

      return {
        image: `data:${contentType};base64,${buffer.toString('base64')}`,
        model: `${model.split('/').pop()} · Cloudflare AI`
      }
    } catch (err) {
      console.error(`[cloudflare] ${model}:`, err.message?.substring(0, 100))
    }
  }
  return null
}

// ─── Nano Banana (Google image models) ───────────────────────────────────────

const NANO_BANANA_MODELS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image']

async function tryNanoBanana(prompt, images = {}) {
  if (!process.env.GOOGLE_API_KEY) return null
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })

  const refEntries = Object.entries(images).filter(([, v]) => v?.base64)
  const parts = refEntries.length > 0
    ? [
        { text: `Generate a high-quality advertising image. Use the reference images for brand colors, style, and identity.\n\nPrompt: ${prompt}` },
        ...refEntries.flatMap(([type, img]) => [
          { text: `Reference (${type}):` },
          { inlineData: { data: img.base64, mimeType: img.mimeType || 'image/jpeg' } }
        ])
      ]
    : [{ text: prompt }]

  for (const model of NANO_BANANA_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: { responseModalities: ['IMAGE', 'TEXT'] }
      })
      const imgPart = (response?.candidates?.[0]?.content?.parts ?? []).find(p => p.inlineData?.data)
      if (!imgPart) continue
      return {
        image: `data:${imgPart.inlineData.mimeType || 'image/jpeg'};base64,${imgPart.inlineData.data}`,
        model: `Nano Banana · ${model}`
      }
    } catch (err) {
      console.error(`[nano-banana] ${model}:`, err.message?.substring(0, 80))
    }
  }
  return null
}

// ─── HuggingFace ──────────────────────────────────────────────────────────────

const HF_MODELS = [
  'black-forest-labs/FLUX.1-schnell',
  'stabilityai/stable-diffusion-xl-base-1.0',
]

async function tryHuggingFace(prompt) {
  if (!process.env.HUGGINGFACE_TOKEN) return null

  for (const model of HF_MODELS) {
    try {
      console.log(`[hf] trying ${model}...`)
      const response = await fetch(
        `https://router.huggingface.co/hf-inference/models/${model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: prompt }),
        }
      )
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      const buffer = Buffer.from(await response.arrayBuffer())
      return {
        image: `data:${contentType};base64,${buffer.toString('base64')}`,
        model: `${model.split('/')[1]} · HuggingFace`
      }
    } catch (err) {
      console.error(`[hf] ${model}:`, err.message?.substring(0, 80))
    }
  }
  return null
}

// ─── DALL-E 3 (OpenAI) ───────────────────────────────────────────────────────

async function tryDallE(prompt, platform) {
  if (!process.env.OPENAI_API_KEY) return null
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const size = DALLE_SIZES[platform] || '1024x1024'
    const response = await openai.images.generate({
      model: 'dall-e-3', prompt, n: 1, size, quality: 'hd', style: 'vivid'
    })
    return { imageUrl: response.data[0].url, model: 'DALL-E 3 · OpenAI' }
  } catch (err) {
    console.error('[dall-e]:', err.message?.substring(0, 80))
    return null
  }
}

// ─── Grok (xAI) ──────────────────────────────────────────────────────────────

async function tryGrok(prompt) {
  if (!process.env.GROK_API_KEY) return null
  try {
    const xai = new OpenAI({ apiKey: process.env.GROK_API_KEY, baseURL: 'https://api.x.ai/v1' })
    const response = await xai.images.generate({ model: 'grok-2-image', prompt, n: 1 })
    return { imageUrl: response.data[0].url, model: 'Grok · xAI' }
  } catch (err) {
    console.error('[grok]:', err.message?.substring(0, 80))
    return null
  }
}

// ─── Pollinations (always works — final fallback) ────────────────────────────

function tryPollinations(prompt, platform) {
  const { w, h } = PLATFORM_DIMS[platform] || { w: 1024, h: 1024 }
  const seed = Math.floor(Math.random() * 999999)
  const imageUrl =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${w}&height=${h}&model=flux&nologo=true&enhance=true&seed=${seed}`
  return { imageUrl, model: 'Flux · Pollinations.ai', dimensions: `${w}×${h}` }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { prompt, platform, images = {} } = req.body
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' })

  const dims = PLATFORM_DIMS[platform] || { w: 1024, h: 1024 }
  const refCount = Object.values(images).filter(v => v?.base64).length
  console.log(`[image-gen] platform=${platform} refs=${refCount}`)

  try {
    // Priority: Cloudflare → Nano Banana → HuggingFace → DALL-E 3 → Grok → Pollinations
    const result =
      await tryCloudflare(prompt) ||
      await tryNanoBanana(prompt, images) ||
      await tryHuggingFace(prompt) ||
      await tryDallE(prompt, platform) ||
      await tryGrok(prompt) ||
      tryPollinations(prompt, platform)

    return res.json({
      ...result,
      dimensions: result.dimensions || `${dims.w}×${dims.h}`,
      aspectRatio: ASPECT_RATIOS[platform] || '1:1'
    })
  } catch (err) {
    console.error('[image-gen] unhandled:', err.message)
    // Even on unexpected error, return Pollinations URL so user gets something
    const fallback = tryPollinations(prompt, platform)
    return res.json({
      ...fallback,
      dimensions: `${dims.w}×${dims.h}`,
      aspectRatio: ASPECT_RATIOS[platform] || '1:1'
    })
  }
}
