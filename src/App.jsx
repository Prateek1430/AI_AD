import { useState, useRef, useCallback } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'TikTok', 'Google Ads', 'Twitter/X']
const OBJECTIVES = ['App Downloads', 'Awareness', 'Lead Generation', 'Sales/Conversions', 'Retargeting', 'Engagement']

const SECTION_META = {
  'Campaign Concept':          { icon: '◈', wide: true },
  'Ad Analysis':               { icon: '◎', wide: true },
  'Ad Headlines':              { icon: '◎', wide: false },
  'Ad Copy':                   { icon: '✦', wide: false },
  'CTA Options':               { icon: '⊕', wide: false },
  'Visual Direction':          { icon: '◐', wide: true },
  'Creative Layout Structure': { icon: '▣', wide: false },
  'AI Image Generation Prompt':{ icon: '⬡', wide: true },
  'Color Palette':             { icon: '◑', wide: false },
  'Font Recommendations':      { icon: 'Aa', wide: false },
  'Designer Notes':            { icon: '◆', wide: false },
  'Creative Variations':       { icon: '⋮⋮', wide: true },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSections(content) {
  const sections = []
  let current = null

  for (const line of content.split('\n')) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current)
      current = { title: line.slice(3).trim(), content: '' }
    } else if (line.startsWith('### ') && current) {
      current.content += `\n__SUB__${line.slice(4).trim()}\n`
    } else if (current) {
      current.content += line + '\n'
    }
  }
  if (current) sections.push(current)
  return sections
}

function extractHexCodes(text) {
  return [...new Set([...text.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map(m => m[0]))]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InlineText({ text }) {
  const parts = text.split(/\*\*/)
  return (
    <span>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i} className="text-white font-semibold">{part}</strong>
          : part
      )}
    </span>
  )
}

function ContentRenderer({ content }) {
  const lines = content.trim().split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    // Subsection header
    if (line.startsWith('__SUB__')) {
      elements.push(
        <p key={i} className="text-sm font-semibold text-indigo-400 mt-5 mb-2 uppercase tracking-wider">
          {line.slice(7)}
        </p>
      )
      i++
      continue
    }

    // Numbered list item
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)[1]
      const text = line.replace(/^\d+\.\s/, '')
      elements.push(
        <div key={i} className="flex gap-3 py-1.5">
          <span className="text-indigo-400 font-mono text-xs mt-0.5 shrink-0 w-4">{num}.</span>
          <p className="text-gray-300 text-sm leading-relaxed"><InlineText text={text} /></p>
        </div>
      )
      i++
      continue
    }

    // Bullet point
    if (/^[-•–]\s/.test(line)) {
      const text = line.replace(/^[-•–]\s/, '')
      elements.push(
        <div key={i} className="flex gap-3 py-1">
          <span className="text-indigo-500 mt-1.5 shrink-0 text-xs">▸</span>
          <p className="text-gray-300 text-sm leading-relaxed"><InlineText text={text} /></p>
        </div>
      )
      i++
      continue
    }

    // Bold-only line (standalone label)
    if (/^\*\*.+\*\*[:：]?$/.test(line.trim())) {
      elements.push(
        <p key={i} className="text-white font-semibold text-sm mt-3 mb-1">{line.replace(/\*\*/g, '')}</p>
      )
      i++
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-gray-300 text-sm leading-relaxed">
        <InlineText text={line} />
      </p>
    )
    i++
  }

  return <div className="space-y-0.5">{elements}</div>
}

function ColorSwatch({ hex }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(hex)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      title={`Copy ${hex}`}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#252535] hover:border-[#3A3A50] bg-[#13131F] transition-all group"
    >
      <span
        className="w-5 h-5 rounded-full border border-white/10 shrink-0"
        style={{ background: hex }}
      />
      <span className="text-xs font-mono text-gray-400 group-hover:text-white transition-colors">{hex}</span>
      {copied
        ? <span className="text-xs text-green-400 ml-1">✓</span>
        : <span className="text-xs text-gray-600 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">copy</span>
      }
    </button>
  )
}

function SectionCard({ section, isLast, isStreaming, platform }) {
  const [copied, setCopied] = useState(false)
  const meta = SECTION_META[section.title] || { icon: '◈', wide: false }
  const hexColors = section.title === 'Color Palette' ? extractHexCodes(section.content) : []
  const isAIPrompt = section.title === 'AI Image Generation Prompt'

  const copy = () => {
    navigator.clipboard.writeText(section.content.replace(/__SUB__/g, '\n').trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`bg-[#0E0E1A] border border-[#252535] rounded-2xl p-6 relative group transition-all animate-fade-in ${
        meta.wide ? 'md:col-span-2' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-base text-indigo-400 font-mono w-5 text-center">{meta.icon}</span>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            {section.title}
          </h3>
        </div>
        <button
          onClick={copy}
          className="opacity-0 group-hover:opacity-100 transition-all text-xs text-gray-500 hover:text-white px-2.5 py-1 rounded-md border border-[#252535] hover:border-[#3A3A50] hover:bg-[#13131F]"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* Content */}
      {isAIPrompt ? (
        <div>
          <div className="bg-[#13131F] border border-[#252535] rounded-xl p-4">
            <p className={`text-sm text-gray-300 font-mono leading-relaxed ${isLast && isStreaming ? 'cursor-blink' : ''}`}>
              {section.content.trim()}
            </p>
            <button
              onClick={copy}
              className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Copy prompt →
            </button>
          </div>
          {!isStreaming && section.content.trim() && (
            <ImageGenerator prompt={section.content.trim()} platform={platform} />
          )}
        </div>
      ) : (
        <div className={isLast && isStreaming ? 'cursor-blink' : ''}>
          <ContentRenderer content={section.content} />
        </div>
      )}

      {/* Color swatches */}
      {hexColors.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#1A1A2E]">
          {hexColors.map(hex => <ColorSwatch key={hex} hex={hex} />)}
        </div>
      )}
    </div>
  )
}

// ─── Image Generator ──────────────────────────────────────────────────────────

function ImageGenerator({ prompt, platform }) {
  const [status, setStatus]       = useState('idle') // idle | waiting | loading | done | error
  const [imageUrl, setImageUrl]   = useState(null)
  const [usedModel, setUsedModel] = useState('')
  const [dims, setDims]           = useState('')
  const [errMsg, setErrMsg]       = useState('')

  const generate = async () => {
    setStatus('waiting')
    setImageUrl(null)
    setErrMsg('')
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), platform })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      // URL is ready — image still needs to render (show spinner until onLoad)
      setImageUrl(data.imageUrl)
      setUsedModel(data.model)
      setDims(data.dimensions)
      setStatus('loading') // image is fetching from Pollinations
    } catch (e) {
      setErrMsg(e.message)
      setStatus('error')
    }
  }

  const download = async () => {
    try {
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ad-creative-${(platform || 'image').toLowerCase().replace(/\//g, '-')}.jpg`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      window.open(imageUrl, '_blank')
    }
  }

  if (status === 'idle') return (
    <button
      onClick={generate}
      className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600/20 to-purple-600/20 hover:from-indigo-600/40 hover:to-purple-600/40 border border-indigo-500/30 hover:border-indigo-500/60 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-all flex items-center justify-center gap-2"
    >
      <span>⬡</span> Generate Image
    </button>
  )

  if (status === 'error') return (
    <div className="mt-4 space-y-2">
      <p className="text-red-400 text-xs bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3 leading-relaxed break-words">
        {errMsg}
      </p>
      <button onClick={() => setStatus('idle')} className="text-xs text-gray-500 hover:text-white transition-colors">
        ← Try again
      </button>
    </div>
  )

  return (
    <div className="mt-4 space-y-3 animate-fade-in">
      {/* Spinner shown while Pollinations renders the image */}
      {status === 'loading' && (
        <div className="rounded-xl border border-border bg-[#0A0A14] p-10 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-gray-500 text-xs text-center">
            Flux is rendering your ad visual…<br />
            <span className="text-gray-600">usually 5–15 seconds</span>
          </p>
        </div>
      )}

      {/* Image — hidden until loaded, then fades in */}
      {imageUrl && (
        <div className={status === 'done' ? 'animate-fade-in' : ''}>
          <div className="relative group rounded-xl overflow-hidden border border-border">
            <img
              src={imageUrl}
              alt="Generated ad creative"
              className={`w-full object-cover rounded-xl transition-opacity duration-500 ${status === 'done' ? 'opacity-100' : 'opacity-0 absolute'}`}
              onLoad={() => setStatus('done')}
              onError={() => { setStatus('error'); setErrMsg('Image failed to load from Pollinations. Try regenerating.') }}
            />
            {status === 'done' && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  onClick={download}
                  className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  ↓ Download
                </button>
                <button
                  onClick={generate}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  ↺ Regenerate
                </button>
              </div>
            )}
          </div>
          {status === 'done' && (
            <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
              <span>{usedModel}</span>
              <span>{dims} · {platform}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Form fields ──────────────────────────────────────────────────────────────

function Field({ label, name, value, onChange, placeholder, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
        {label}{required && <span className="text-indigo-400 ml-1">*</span>}
      </label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
      />
    </div>
  )
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={onChange}
          className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all appearance-none cursor-pointer pr-10"
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">▾</span>
      </div>
    </div>
  )
}

function LoadingDots({ model }) {
  return (
    <div className="flex items-center gap-2 text-gray-500 text-sm">
      <span>{model ? `Running on ${model}` : 'Connecting'}</span>
      <span className="flex gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('form')
  const [form, setForm] = useState({
    brandName: '',
    product: '',
    targetAudience: '',
    platform: 'Instagram',
    objective: 'App Downloads'
  })
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeModel, setActiveModel] = useState('')
  const [error, setError] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [screenshotPreview, setScreenshotPreview] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()
  const outputRef = useRef()

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const streamFromUrl = useCallback(async (url, options) => {
    setLoading(true)
    setOutput('')
    setError('')
    setActiveModel('')

    try {
      const res = await fetch(url, options)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server error ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
          try {
            const { text, error: apiError, model } = JSON.parse(line.slice(6))
            if (text) setOutput(prev => prev + text)
            if (apiError) setError(apiError)
            if (model) setActiveModel(model)
          } catch {}
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Check your API key in .env')
    }

    setLoading(false)
    setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }, [])

  const handleGenerate = () => {
    if (!form.brandName.trim() || !form.product.trim()) {
      setError('Brand Name and Product are required.')
      return
    }
    streamFromUrl('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
  }

  const handleFileSelect = file => {
    if (!file || !file.type.startsWith('image/')) return
    setScreenshot(file)
    setScreenshotPreview(URL.createObjectURL(file))
  }

  const handleAnalyze = () => {
    if (!screenshot) { setError('Please upload a screenshot first.'); return }
    const reader = new FileReader()
    reader.readAsDataURL(screenshot)
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      streamFromUrl('/api/analyze-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType: screenshot.type, platform: form.platform, objective: form.objective })
      })
    }
    reader.onerror = () => setError('Failed to read image. Try again.')
  }

  const sections = output ? parseSections(output) : []

  return (
    <div className="min-h-screen bg-[#07070F] font-sans">

      {/* ── Header ── */}
      <header className="border-b border-[#1A1A2E] px-6 py-4 sticky top-0 z-50 bg-[#07070F]/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-indigo-500/20">
              AI
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">Ad Creative Generator</p>
              <p className="text-xs text-gray-500 leading-none mt-0.5">by BrainFog</p>
            </div>
          </div>
          <span className="text-xs text-gray-600 hidden sm:block">Powered by Gemini 3.5 Flash</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

        {/* ── Hero ── */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-5xl font-bold text-gradient mb-3 leading-tight">
            Generate Ad Creatives
          </h1>
          <p className="text-gray-500 text-sm sm:text-base max-w-lg mx-auto">
            Agency-grade creative briefs — campaign concept, copy, visuals, and variations — in seconds.
          </p>
        </div>

        {/* ── Mode Tabs ── */}
        <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 mb-8 w-fit mx-auto">
          {[
            ['form', '✦ Generate Creative'],
            ['screenshot', '⊕ From Screenshot']
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError('') }}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Form Card ── */}
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 mb-8 card-glow">

          {tab === 'form' ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Brand Name" name="brandName" value={form.brandName} onChange={handleChange} placeholder="e.g. Nuqi Gold" required />
                <Field label="Product / Service" name="product" value={form.product} onChange={handleChange} placeholder="e.g. Gold Investment App" required />
              </div>
              <Field
                label="Target Audience"
                name="targetAudience"
                value={form.targetAudience}
                onChange={handleChange}
                placeholder="e.g. Working Professionals 25–45  (optional — will be inferred)"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField label="Platform" name="platform" value={form.platform} onChange={handleChange} options={PLATFORMS} />
                <SelectField label="Objective" name="objective" value={form.objective} onChange={handleChange} options={OBJECTIVES} />
              </div>

              {error && <p className="text-red-400 text-sm bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>}

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-semibold text-sm tracking-wide transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <span className="flex items-center justify-center gap-2"><LoadingDots model={activeModel} /></span> : 'Generate Creative Brief →'}
              </button>
            </div>

          ) : (
            <div className="space-y-5">
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]) }}
                onClick={() => fileRef.current.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-indigo-500 bg-indigo-500/5' : 'border-border hover:border-indigo-500/50 hover:bg-[#13131F]'
                }`}
              >
                {screenshotPreview ? (
                  <div className="space-y-3">
                    <img src={screenshotPreview} alt="Preview" className="max-h-64 mx-auto rounded-lg shadow-xl" />
                    <p className="text-xs text-gray-500">{screenshot?.name} — click to change</p>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl mb-3 text-gray-600">⊕</div>
                    <p className="text-gray-400 text-sm font-medium">Drop an ad screenshot here</p>
                    <p className="text-gray-600 text-xs mt-1">or click to browse — PNG, JPG, WEBP up to 10MB</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleFileSelect(e.target.files[0])}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField label="Platform" name="platform" value={form.platform} onChange={handleChange} options={PLATFORMS} />
                <SelectField label="Objective" name="objective" value={form.objective} onChange={handleChange} options={OBJECTIVES} />
              </div>

              {error && <p className="text-red-400 text-sm bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>}

              <button
                onClick={handleAnalyze}
                disabled={loading || !screenshot}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-semibold text-sm tracking-wide transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2"><LoadingDots model={activeModel} /></span>
                  : 'Analyze & Generate Brief →'
                }
              </button>

              {!screenshot && (
                <p className="text-center text-xs text-gray-600">
                  Upload any ad image — we'll deconstruct it and generate an original brief inspired by it.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Output ── */}
        {(loading || sections.length > 0) && (
          <div ref={outputRef}>
            {/* Section header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 w-12 bg-gradient-to-r from-indigo-500/50 to-transparent" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gradient-purple">
                  Creative Brief
                </h2>
                <div className="h-px flex-1 w-12 bg-gradient-to-l from-purple-500/50 to-transparent" />
              </div>
              {!loading && output && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(output)
                  }}
                  className="text-xs text-gray-500 hover:text-white border border-border hover:border-[#3A3A50] px-3 py-1.5 rounded-lg transition-all"
                >
                  Copy All
                </button>
              )}
            </div>

            {/* Sections grid */}
            {sections.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sections.map((section, i) => (
                  <SectionCard
                    key={section.title + i}
                    section={section}
                    isLast={i === sections.length - 1}
                    isStreaming={loading}
                    platform={form.platform}
                  />
                ))}
              </div>
            )}

            {/* Loading skeleton when no sections yet */}
            {loading && sections.length === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`bg-surface border border-border rounded-2xl p-6 animate-pulse ${i === 0 ? 'md:col-span-2' : ''}`}>
                    <div className="h-3 bg-[#1A1A2E] rounded w-1/3 mb-4" />
                    <div className="space-y-2">
                      <div className="h-2 bg-[#1A1A2E] rounded w-full" />
                      <div className="h-2 bg-[#1A1A2E] rounded w-5/6" />
                      <div className="h-2 bg-[#1A1A2E] rounded w-4/6" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1A1A2E] px-6 py-6 mt-16">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-gray-600">
          <span>AI Ad Creative Generator — BrainFog 2026</span>
          <span>Gemini 3.5 Flash · Streaming · Vision</span>
        </div>
      </footer>
    </div>
  )
}
