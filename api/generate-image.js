import OpenAI from 'openai'
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { prompt, platform } = req.body
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' })

  // Try DALL-E 3 if OpenAI key exists
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const size = DALLE_SIZES[platform] || '1024x1024'

      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        quality: 'hd',
        style: 'vivid',
      })

      return res.json({
        imageUrl: response.data[0].url,
        model: 'DALL-E 3 · OpenAI',
        dimensions: size.replace('x', '×'),
        aspectRatio: ASPECT_RATIOS[platform] || '1:1'
      })
    } catch (err) {
      console.error('[dalle] failed:', err.message?.substring(0, 100))
      // fall through to Pollinations
    }
  }

  // Fallback: Pollinations (Flux) — free, no key needed
  const { w, h } = PLATFORM_DIMS[platform] || { w: 1024, h: 1024 }
  const seed = Math.floor(Math.random() * 999999)
  const imageUrl =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${w}&height=${h}&model=flux&nologo=true&enhance=true&seed=${seed}`

  res.json({
    imageUrl,
    model: 'Flux · Pollinations.ai',
    dimensions: `${w}×${h}`,
    aspectRatio: ASPECT_RATIOS[platform] || '1:1'
  })
}
