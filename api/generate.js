import { buildPrompt, streamToResponse } from './_shared.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { brandName, product, targetAudience, platform, objective } = req.body
  if (!brandName || !product || !platform || !objective) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  await streamToResponse(res, buildPrompt({ brandName, product, targetAudience, platform, objective }))
}
