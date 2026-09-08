import { useEffect, useRef, useState } from 'react'
import { decodeImage, type DecodeResult } from '../core'
import { describeCameraError } from './cameraErrors'

interface Props {
  /** Called once, with the decoded codes and a PNG data URL of the frame they were found in. */
  onDetected: (results: DecodeResult[], snapshot: string) => void
  onCancel: () => void
}

/** Minimum time between decode attempts. Decoding a 800px frame takes ~20-60 ms. */
const SCAN_INTERVAL_MS = 150
/** Frames wider than this are downscaled before decoding; QR codes do not need more. */
const MAX_FRAME_WIDTH = 800

export default function CameraScanner({ onDetected, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected

  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(true)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    let stream: MediaStream | null = null
    let cancelled = false
    let timer = 0

    const stop = () => {
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
      video.srcObject = null
    }

    // A timer rather than requestAnimationFrame: decoding is paced by time, and
    // timers keep running (throttled) when the tab is hidden, so a scan resumes
    // promptly when the user comes back.
    const tick = async () => {
      if (cancelled) return
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          try {
            const results = await decodeImage(ctx.getImageData(0, 0, canvas.width, canvas.height))
            if (cancelled) return
            if (results.length > 0) {
              const snapshot = canvas.toDataURL('image/png')
              stop()
              onDetectedRef.current(results, snapshot)
              return
            }
          } catch {
            // A bad frame is not fatal; keep scanning.
          }
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, SCAN_INTERVAL_MS)
    }

    const start = async () => {
      setStarting(true)
      setError(null)
      try {
        const video_constraints: MediaTrackConstraints = deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        stream = await navigator.mediaDevices.getUserMedia({ video: video_constraints, audio: false })
        if (cancelled) {
          stop()
          return
        }
        video.srcObject = stream
        await video.play()
        if (cancelled) return
        setStarting(false)
        // Labels are only populated after permission is granted, so enumerate now.
        const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
        if (!cancelled) setDevices(list)
        timer = window.setTimeout(tick, SCAN_INTERVAL_MS)
      } catch (err) {
        if (cancelled) return
        stop()
        setStarting(false)
        setError(describeCameraError(err))
      }
    }

    void start()
    return () => {
      cancelled = true
      stop()
    }
  }, [deviceId])

  return (
    <div className="scanner">
      <div className="scanner-viewport">
        <video ref={videoRef} playsInline muted autoPlay aria-label="Camera preview" />
        {!error && <div className="scanner-guide" aria-hidden="true" />}
        {starting && !error && <p className="scanner-status">Starting camera...</p>}
        {!starting && !error && <p className="scanner-status">Point the camera at a QR code</p>}
        {error && (
          <p className="error scanner-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <canvas ref={canvasRef} hidden />
      <div className="actions">
        {devices.length > 1 && (
          <select
            aria-label="Camera"
            value={deviceId ?? ''}
            onChange={(e) => setDeviceId(e.target.value || undefined)}
          >
            <option value="">Default camera</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="button-secondary" onClick={onCancel}>
          {error ? 'Back' : 'Stop camera'}
        </button>
      </div>
    </div>
  )
}
