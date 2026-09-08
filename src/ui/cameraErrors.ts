/** True when the browser can open a camera at all. */
export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

/** True when the page is served in a way browsers refuse camera access for (plain http, not localhost). */
export function cameraBlockedByInsecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === false
}

/** Turns a getUserMedia failure into a sentence the user can act on. */
export function describeCameraError(err: unknown): string {
  const name = err instanceof Error ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera access was denied. Allow the camera in your browser settings, or use an image file instead.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device. Use an image file instead.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is already in use by another app or tab.'
    case 'SecurityError':
      return 'The camera needs a secure (https) connection.'
    case 'AbortError':
      return 'The camera stopped unexpectedly. Try again.'
    default:
      return err instanceof Error && err.message ? `Could not start the camera: ${err.message}` : 'Could not start the camera.'
  }
}
