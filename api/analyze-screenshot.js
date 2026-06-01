import { buildScreenshotPrompt, streamToResponse } from './_shared.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { base64, mimeType, platform, objective } = req.body
  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'Image data required (base64 + mimeType)' })
  }

  const contents = [
    { text: buildScreenshotPrompt({ platform, objective }) },
    { inlineData: { data: base64, mimeType } }
  ]

  await streamToResponse(res, contents)
}
