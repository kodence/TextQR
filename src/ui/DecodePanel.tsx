import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { asHttpUrl, decodeImage, type DecodeResult, type HistoryEntry } from '../core'
import CameraScanner from './CameraScanner'
import { cameraBlockedByInsecureContext, cameraSupported } from './cameraErrors'
import { useHistory } from './useHistory'

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; results: DecodeResult[] }
  | { kind: 'error'; message: string }

type Preview = { url: string; name: string; revoke: boolean }

function firstImageFile(files: Iterable<File> | null | undefined): File | null {
  if (!files) return null
  for (const f of files) if (f.type.startsWith('image/')) return f
  return null
}

export default function DecodePanel() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [preview, setPreview] = useState<Preview | null>(null)
  const [dragging, setDragging] = useState(false)
  const [scanning, setScanning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canUseCamera = cameraSupported()
  const history = useHistory()
  // The file/camera callbacks are memoised, so they reach the latest history via a ref.
  const historyRef = useRef(history)
  historyRef.current = history

  const replacePreview = (next: Preview | null) =>
    setPreview((old) => {
      if (old?.revoke) URL.revokeObjectURL(old.url)
      return next
    })

  const handleFile = useCallback(async (file: File) => {
    setScanning(false)
    replacePreview({ url: URL.createObjectURL(file), name: file.name || 'pasted image', revoke: true })
    setStatus({ kind: 'busy' })
    try {
      const results = await decodeImage(file)
      setStatus({ kind: 'done', results })
      historyRef.current.record(results)
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message })
    }
  }, [])

  const handleDetected = useCallback((results: DecodeResult[], snapshot: string) => {
    setScanning(false)
    replacePreview({ url: snapshot, name: 'camera frame', revoke: false })
    setStatus({ kind: 'done', results })
    historyRef.current.record(results)
  }, [])

  const showHistoryEntry = (entry: HistoryEntry) => {
    setScanning(false)
    replacePreview(null)
    setStatus({ kind: 'done', results: [{ text: entry.text, format: entry.format, contentType: 'Text' }] })
  }

  // Paste an image anywhere on the page while this panel is open.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = firstImageFile(e.clipboardData?.files)
      if (file) {
        e.preventDefault()
        void handleFile(file)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [handleFile])

  // Release the preview URL on unmount.
  useEffect(
    () => () => {
      if (preview?.revoke) URL.revokeObjectURL(preview.url)
    },
    [preview],
  )

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = firstImageFile(e.dataTransfer.files)
    if (file) void handleFile(file)
    else setStatus({ kind: 'error', message: 'Drop an image file.' })
  }

  return (
    <section className="panel decode-panel">
      <div className="decode-source">
        {scanning ? (
          <CameraScanner onDetected={handleDetected} onCancel={() => setScanning(false)} />
        ) : (
          <div
            className={dragging ? 'dropzone dropzone-active' : 'dropzone'}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
            }}
            aria-label="Choose, drop, or paste an image containing a QR code"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = firstImageFile(e.target.files)
                if (file) void handleFile(file)
                e.target.value = ''
              }}
            />
            {preview ? (
              <img className="dropzone-preview" src={preview.url} alt={`Selected image: ${preview.name}`} />
            ) : (
              <div className="dropzone-hint">
                <strong>Drop an image here</strong>
                <span>or click to choose a file, or paste with Ctrl+V</span>
              </div>
            )}
          </div>
        )}

        {!scanning && (
          <div className="actions">
            {canUseCamera ? (
              <button type="button" onClick={() => setScanning(true)}>
                {preview ? 'Scan with camera again' : 'Scan with camera'}
              </button>
            ) : (
              <p className="placeholder camera-unavailable">
                {cameraBlockedByInsecureContext()
                  ? 'Camera scanning needs an https connection. Image files still work.'
                  : 'Camera scanning is not available in this browser. Image files still work.'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="decode-results">
        {status.kind === 'idle' && <p className="placeholder">Decoded text appears here.</p>}
        {status.kind === 'busy' && <p className="placeholder">Reading...</p>}
        {status.kind === 'error' && (
          <p className="error" role="alert">
            {status.message}
          </p>
        )}
        {status.kind === 'done' && status.results.length === 0 && (
          <p className="error" role="alert">
            No QR code found. Try a sharper or larger image.
          </p>
        )}
        {status.kind === 'done' &&
          status.results.map((r, i) => <ResultCard key={i} result={r} index={i} total={status.results.length} />)}

        <section className="history" aria-label="Scan history">
          <label className="history-toggle">
            <input type="checkbox" checked={history.enabled} onChange={(e) => history.setEnabled(e.target.checked)} />
            Remember scans on this device
          </label>
          {history.enabled && history.entries.length > 0 && (
            <>
              <ul className="history-list">
                {history.entries.map((entry) => (
                  <li key={`${entry.at}-${entry.text}`}>
                    <button type="button" className="history-item" onClick={() => showHistoryEntry(entry)}>
                      <span className="history-text">{entry.text}</span>
                      <time className="history-time" dateTime={new Date(entry.at).toISOString()}>
                        {formatWhen(entry.at)}
                      </time>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="button-secondary history-clear" onClick={history.clear}>
                Clear history
              </button>
            </>
          )}
          {history.enabled && history.entries.length === 0 && (
            <p className="placeholder history-empty">Scans you make from now on will be listed here.</p>
          )}
        </section>
      </div>
    </section>
  )
}

function formatWhen(at: number): string {
  const d = new Date(at)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ResultCard({ result, index, total }: { result: DecodeResult; index: number; total: number }) {
  const [text, setText] = useState(result.text)
  const [copied, setCopied] = useState(false)
  const url = asHttpUrl(text)

  useEffect(() => setText(result.text), [result])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="result-card">
      <div className="result-meta">
        {total > 1 && (
          <span>
            Code {index + 1} of {total}
          </span>
        )}
        <span>{result.format}</span>
        <span>{[...text].length} chars</span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} aria-label="Decoded text" />
      <div className="actions">
        <button type="button" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        {url && (
          <a className="button-link" href={url} target="_blank" rel="noopener noreferrer">
            Open link
          </a>
        )}
      </div>
    </div>
  )
}
