export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

/** Maximum UTF-8 byte payload for a version-40 QR code in byte mode, per EC level. */
export const BYTE_CAPACITY: Record<ErrorCorrectionLevel, number> = {
  L: 2953,
  M: 2331,
  Q: 1663,
  H: 1273,
}

export interface CapacityCheck {
  bytes: number
  chars: number
  limit: number
  ok: boolean
  /** Bytes over the limit; 0 when within capacity. */
  over: number
}

const encoder = new TextEncoder()

export function utf8ByteLength(text: string): number {
  return encoder.encode(text).length
}

/**
 * Checks whether `text` fits in a QR code at the given EC level.
 * Uses the byte-mode limit, which is conservative: purely numeric or
 * alphanumeric text can hold more, and the encoder picks those modes itself.
 */
export function checkCapacity(text: string, level: ErrorCorrectionLevel): CapacityCheck {
  const bytes = utf8ByteLength(text)
  const limit = BYTE_CAPACITY[level]
  const over = Math.max(0, bytes - limit)
  return { bytes, chars: [...text].length, limit, ok: over === 0, over }
}
