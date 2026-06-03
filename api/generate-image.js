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

// Nano Banana models (Google image generation)
const NANO_BANANA_MODELS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image']

async function tryNanoBanana(prompt, images = {}) {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })

  // Build parts: text prompt + any uploaded reference images
  const refEntries = Object.entries(images).filter(([, v]) => v?.base64)
  const parts = []

  if (refEntries.length > 0) {
    parts.push({ text: `Generate a high-quality advertising image based on this prompt. Use the provided reference images for visual context — incorporate the brand colors, style, composition, and identity you see in them.\n\nImage prompt:\n${prompt}` })
    for (const [type, img] of refEntries) {
      parts.push({ text: `Reference (${type}):` })
      parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType || 'image/jpeg' } })
    }
  } else {
    parts.push({ text: prompt })
  }

  for (const model of NANO_BANANA_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: { responseModalities: ['IMAGE', 'TEXT'] }
      })

      const resParts = response?.candidates?.[0]?.content?.parts ?? []
      const imgPart = resParts.find(p => p.inlineData?.data)
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

async function tryGrok(prompt) {
  if (!process.env.GROK_API_KEY) return null
  try {
    const xai = new OpenAI({
      apiKey: process.env.GROK_API_KEY,
      baseURL: 'https://api.x.ai/v1'
    })
    const response = await xai.images.generate({
      model: 'grok-2-image', prompt, n: 1
    })
    return { imageUrl: response.data[0].url, model: 'Grok · xAI' }
  } catch (err) {
    console.error('[grok]:', err.message?.substring(0, 80))
    return null
  }
}

async function tryPollinations(prompt, platform) {
  const { w, h } = PLATFORM_DIMS[platform] || { w: 1024, h: 1024 }
  const seed = Math.floor(Math.random() * 999999)
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${w}&height=${h}&model=flux&nologo=true&enhance=true&seed=${seed}`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(45000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    return {
      image: `data:image/jpeg;base64,${buffer.toString('base64')}`,
      model: 'Flux · Pollinations.ai',
      dimensions: `${w}×${h}`
    }
  } catch (err) {
    console.error('[pollinations]:', err.message)
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { prompt, platform, images = {} } = req.body
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' })

  const dims = PLATFORM_DIMS[platform] || { w: 1024, h: 1024 }
  const refCount = Object.values(images).filter(v => v?.base64).length
  console.log(`[image-gen] platform=${platform} refs=${refCount}`)

  // Priority chain: Nano Banana (with refs) → DALL-E 3 → Grok → Pollinations
  const result =
    await tryNanoBanana(prompt, images) ||
    await tryDallE(prompt, platform) ||
    await tryGrok(prompt) ||
    await tryPollinations(prompt, platform)

  if (!result) {
    return res.status(500).json({ error: 'All image generation services failed. Try again.' })
  }

  res.json({
    ...result,
    dimensions: result.dimensions || `${dims.w}×${dims.h}`,
    aspectRatio: ASPECT_RATIOS[platform] || '1:1'
  })
}
