import { useEffect, useRef, useState } from 'react'
import {
  checkCapacity,
  DEFAULT_ENCODE_OPTIONS,
  encodeToCanvas,
  encodeToPngDataUrl,
  encodeToSvg,
  type EncodeOptions,
  type ErrorCorrectionLevel,
} from '../core'

const EC_LEVELS: { value: ErrorCorrectionLevel; label: string }[] = [
  { value: 'L', label: 'L (7% recovery)' },
  { value: 'M', label: 'M (15% recovery)' },
  { value: 'Q', label: 'Q (25% recovery)' },
  { value: 'H', label: 'H (30% recovery)' },
]

function download(filename: string, href: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

export default function EncodePanel() {
  const [text, setText] = useState('')
  const [opts, setOpts] = useState<EncodeOptions>(DEFAULT_ENCODE_OPTIONS)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canCopyImage = typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'

  const capacity = checkCapacity(text, opts.errorCorrectionLevel)
  const canRender = text.length > 0 && capacity.ok

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!canRender) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      setError(null)
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      encodeToCanvas(canvas, text, opts)
        .then(() => !cancelled && setError(null))
        .catch((e: Error) => !cancelled && setError(e.message))
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [text, opts, canRender])

  const update = <K extends keyof EncodeOptions>(key: K, value: EncodeOptions[K]) =>
    setOpts((o) => ({ ...o, [key]: value }))

  const onDownloadPng = async () => {
    try {
      download('qr.png', await encodeToPngDataUrl(text, opts))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const onCopyPng = async () => {
    try {
      // Pass a promise so Safari accepts the write inside the click gesture.
      const blob = encodeToPngDataUrl(text, opts)
        .then((url) => fetch(url))
        .then((r) => r.blob())
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      setError(`Could not copy the image: ${(e as Error).message}`)
    }
  }

  const onDownloadSvg = async () => {
    try {
      const svg = await encodeToSvg(text, opts)
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      download('qr.svg', url)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="panel encode-panel">
      <div className="encode-input">
        <label htmlFor="qr-text">Text</label>
        <textarea
          id="qr-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste text, a URL, or anything else"
          rows={8}
          autoFocus
        />
        <div className={capacity.ok ? 'capacity' : 'capacity capacity-over'} aria-live="polite">
          {capacity.chars} chars, {capacity.bytes} / {capacity.limit} bytes
          {!capacity.ok && `. ${capacity.over} bytes over: shorten the text or lower the error-correction level.`}
        </div>

        <fieldset className="options">
          <legend>Options</legend>
          <label>
            Error correction
            <select
              value={opts.errorCorrectionLevel}
              onChange={(e) => update('errorCorrectionLevel', e.target.value as ErrorCorrectionLevel)}
            >
              {EC_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Size (px)
            <input
              type="number"
              min={64}
              max={2048}
              step={32}
              value={opts.width}
              onChange={(e) => update('width', clamp(Number(e.target.value), 64, 2048))}
            />
          </label>
          <label>
            Margin (modules)
            <input
              type="number"
              min={0}
              max={16}
              value={opts.margin}
              onChange={(e) => update('margin', clamp(Number(e.target.value), 0, 16))}
            />
          </label>
          <label>
            Foreground
            <input
              type="color"
              value={opts.color.dark}
              onChange={(e) => update('color', { ...opts.color, dark: e.target.value })}
            />
          </label>
          <label>
            Background
            <input
              type="color"
              value={opts.color.light}
              onChange={(e) => update('color', { ...opts.color, light: e.target.value })}
            />
          </label>
        </fieldset>
      </div>

      <div className="encode-output">
        <div className="preview" aria-label="QR code preview">
          <canvas ref={canvasRef} hidden={!canRender} />
          {!canRender && <span className="preview-empty">{text ? 'Too long to encode' : 'Preview appears here'}</span>}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button onClick={onDownloadPng} disabled={!canRender}>
            Download PNG
          </button>
          <button onClick={onDownloadSvg} disabled={!canRender}>
            Download SVG
          </button>
          {canCopyImage && (
            <button onClick={onCopyPng} disabled={!canRender}>
              {copied ? 'Copied' : 'Copy PNG'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
