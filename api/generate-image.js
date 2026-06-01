import { ASPECT_RATIOS, PLATFORM_DIMS } from './_shared.js'

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { prompt, platform } = req.body
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' })

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
