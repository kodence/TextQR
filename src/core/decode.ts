import {
  prepareZXingModule,
  readBarcodes,
  type ReaderOptions,
  type ZXingModuleOverrides,
} from 'zxing-wasm/reader'

/** Anything the decoder can read: an image file, its raw bytes, or raw pixels. */
export type DecodeInput = Blob | ArrayBuffer | Uint8Array | ImageData

export interface DecodeResult {
  text: string
  /** e.g. "QRCode", "MicroQRCode". */
  format: string
  /** ZXing's guess at the payload type, e.g. "Text", "Binary". */
  contentType: string
}

export class DecodeError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'DecodeError'
  }
}

const READER_OPTIONS: ReaderOptions = {
  formats: ['QRCode', 'MicroQRCode', 'rMQRCode'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 8,
}

/**
 * Tell the decoder where its WebAssembly binary lives. Must be called once,
 * before the first decode. The browser build passes a `locateFile` that points
 * at the bundled asset; Node callers pass `wasmBinary` directly. Without this,
 * zxing-wasm fetches the binary from a public CDN, which we never want.
 */
export function configureDecoder(overrides: ZXingModuleOverrides): void {
  prepareZXingModule({ overrides, fireImmediately: false })
}

/**
 * Finds every QR code in the image. Returns an empty array when the image
 * decodes fine but contains no QR code; throws DecodeError when the input is
 * not a readable image at all.
 */
export async function decodeImage(input: DecodeInput): Promise<DecodeResult[]> {
  let results
  try {
    results = await readBarcodes(input, READER_OPTIONS)
  } catch (err) {
    throw new DecodeError('Could not read that image. Use a PNG, JPEG, GIF, BMP, or WebP file.', err)
  }
  return results
    .filter((r) => r.isValid)
    .map((r) => ({ text: r.text, format: r.format, contentType: r.contentType }))
}

/** True when `text` is an http(s) URL that is safe to offer as a link. */
export function asHttpUrl(text: string): string | null {
  const trimmed = text.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  try {
    const u = new URL(trimmed)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}
