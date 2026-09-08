import QRCode from 'qrcode'
import type { ErrorCorrectionLevel } from './capacity'

export interface EncodeOptions {
  errorCorrectionLevel: ErrorCorrectionLevel
  /** Rendered width in pixels (PNG/canvas). Ignored for SVG. */
  width: number
  /** Quiet zone in modules. */
  margin: number
  color: {
    dark: string
    light: string
  }
}

export const DEFAULT_ENCODE_OPTIONS: EncodeOptions = {
  errorCorrectionLevel: 'M',
  width: 320,
  margin: 4,
  color: { dark: '#000000', light: '#ffffff' },
}

export class EncodeError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'EncodeError'
  }
}

function wrap(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err)
  if (/too big|too large|exceed/i.test(msg)) {
    throw new EncodeError('Text is too long for a single QR code at this error-correction level.', err)
  }
  throw new EncodeError(msg, err)
}

/**
 * Smallest number of pixels per module that decoders handle reliably.
 * Below about 2 px/module most readers fail; 3 leaves headroom for scaling.
 */
export const MIN_MODULE_PX = 3

/** Number of modules per side for `text` at the given EC level (21 to 177). */
export function moduleCount(text: string, level: ErrorCorrectionLevel = DEFAULT_ENCODE_OPTIONS.errorCorrectionLevel): number {
  return QRCode.create(text, { errorCorrectionLevel: level }).modules.size
}

/**
 * The width actually used for raster output: the requested width, or larger
 * when the requested width would leave fewer than MIN_MODULE_PX per module.
 */
export function effectiveWidth(text: string, opts: Partial<EncodeOptions> = {}): number {
  const o = { ...DEFAULT_ENCODE_OPTIONS, ...opts }
  const modules = moduleCount(text, o.errorCorrectionLevel) + 2 * o.margin
  return Math.max(o.width, modules * MIN_MODULE_PX)
}

function toLibOptions(text: string, opts: Partial<EncodeOptions>) {
  const o = { ...DEFAULT_ENCODE_OPTIONS, ...opts, color: { ...DEFAULT_ENCODE_OPTIONS.color, ...opts.color } }
  return {
    errorCorrectionLevel: o.errorCorrectionLevel,
    width: effectiveWidth(text, o),
    margin: o.margin,
    color: o.color,
  }
}

function assertNonEmpty(text: string): void {
  if (text.length === 0) throw new EncodeError('Nothing to encode.')
}

/** Encode text to a PNG data URL. Works in the browser and in Node. */
export async function encodeToPngDataUrl(text: string, opts: Partial<EncodeOptions> = {}): Promise<string> {
  assertNonEmpty(text)
  try {
    return await QRCode.toDataURL(text, { ...toLibOptions(text, opts), type: 'image/png' })
  } catch (err) {
    wrap(err)
  }
}

/** Encode text to an SVG document string. */
export async function encodeToSvg(text: string, opts: Partial<EncodeOptions> = {}): Promise<string> {
  assertNonEmpty(text)
  try {
    return await QRCode.toString(text, { ...toLibOptions(text, opts), type: 'svg' })
  } catch (err) {
    wrap(err)
  }
}

/** Render text directly into an existing canvas (browser only). */
export async function encodeToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  opts: Partial<EncodeOptions> = {},
): Promise<void> {
  assertNonEmpty(text)
  try {
    await QRCode.toCanvas(canvas, text, toLibOptions(text, opts))
  } catch (err) {
    wrap(err)
  }
}
