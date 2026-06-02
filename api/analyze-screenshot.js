import { buildScreenshotPrompt, buildLogoPrompt, buildProductPrompt, streamToResponse } from './_shared.js'

const PROMPT_MAP = {
  logo:      buildLogoPrompt,
  reference: buildScreenshotPrompt,
  product:   buildProductPrompt,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { base64, mimeType, platform, objective, uploadType = 'reference' } = req.body
  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'Image data required (base64 + mimeType)' })
  }

  const buildPrompt = PROMPT_MAP[uploadType] || buildScreenshotPrompt

  const contents = [
    { text: buildPrompt({ platform, objective }) },
    { inlineData: { data: base64, mimeType } }
  ]

  await streamToResponse(res, contents)
}
