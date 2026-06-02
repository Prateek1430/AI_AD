import {
  buildScreenshotPrompt,
  buildLogoPrompt,
  buildProductPrompt,
  buildCombinedPrompt,
  streamToResponse
} from './_shared.js'

const SINGLE_PROMPT = {
  logo:      buildLogoPrompt,
  reference: buildScreenshotPrompt,
  product:   buildProductPrompt,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { images, platform, objective, brandName, product } = req.body

  // images = { logo: {base64, mimeType}, reference: {...}, product: {...} }
  const types = Object.keys(images || {}).filter(t => images[t]?.base64)

  if (types.length === 0) {
    return res.status(400).json({ error: 'At least one image required' })
  }

  let promptText
  if (types.length === 1) {
    const buildFn = SINGLE_PROMPT[types[0]] || buildScreenshotPrompt
    promptText = buildFn({ platform, objective, brandName, product })
  } else {
    promptText = buildCombinedPrompt({ types, platform, objective, brandName, product })
  }

  const contents = [
    { text: promptText },
    ...types.map(t => ({
      inlineData: { data: images[t].base64, mimeType: images[t].mimeType }
    }))
  ]

  await streamToResponse(res, contents)
}
