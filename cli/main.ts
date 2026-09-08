import { readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import QRCode from 'qrcode'
import {
  checkCapacity,
  configureDecoder,
  decodeImage,
  encodeToPngDataUrl,
  encodeToSvg,
  DEFAULT_ENCODE_OPTIONS,
  type EncodeOptions,
  type ErrorCorrectionLevel,
} from '../src/core'

const require = createRequire(import.meta.url)

/** Everything the CLI touches in the outside world, so tests can capture it. */
export interface Io {
  stdout(chunk: string | Uint8Array): void
  stderr(chunk: string): void
  stdin(): Promise<Uint8Array>
}

export const EXIT_OK = 0
export const EXIT_ERROR = 1
export const EXIT_NOT_FOUND = 2

export const USAGE = `textqr - convert text to QR codes and back

Usage:
  textqr encode [text] [options]     Encode text (or stdin when text is "-" or omitted)
  textqr decode [image] [options]    Read QR codes from an image file (or stdin when "-" or omitted)
  textqr --help | --version

Encode options:
  -o, --out <file>        Write to a file; the extension picks the format (.png or .svg)
                          Use "-" for stdout together with --format
  -f, --format <fmt>      png | svg | terminal (default: terminal when no --out)
  -e, --ec <level>        Error correction: L, M, Q, H (default: M)
  -s, --size <px>         Image width in pixels for PNG (default: 320; grows for large codes)
  -m, --margin <modules>  Quiet zone in modules (default: 4)
      --fg <color>        Foreground colour, e.g. #000000
      --bg <color>        Background colour, e.g. #ffffff

Decode options:
      --json              Print results as a JSON array

Exit codes: 0 ok, 1 error, 2 no QR code found
`

function version(): string {
  try {
    return (require('../package.json') as { version: string }).version
  } catch {
    return 'unknown'
  }
}

let decoderReady = false
function ensureDecoder(): void {
  if (decoderReady) return
  const wasm = new Uint8Array(readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm')))
  configureDecoder({ wasmBinary: wasm.buffer })
  decoderReady = true
}

function dataUrlToBytes(url: string): Uint8Array {
  return new Uint8Array(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))
}

async function readInputText(positional: string | undefined, io: Io): Promise<string> {
  if (positional !== undefined && positional !== '-') return positional
  const text = Buffer.from(await io.stdin()).toString('utf8')
  // Drop exactly one trailing newline so `echo hi | textqr encode` encodes "hi".
  if (text.endsWith('\r\n')) return text.slice(0, -2)
  if (text.endsWith('\n')) return text.slice(0, -1)
  return text
}

async function readInputBytes(positional: string | undefined, io: Io): Promise<Uint8Array> {
  if (positional !== undefined && positional !== '-') return new Uint8Array(await readFile(positional))
  return await io.stdin()
}

type Format = 'png' | 'svg' | 'terminal'

function pickFormat(out: string | undefined, explicit: string | undefined): Format {
  if (explicit) {
    if (explicit === 'png' || explicit === 'svg' || explicit === 'terminal') return explicit
    throw new Error(`Unknown format "${explicit}". Use png, svg, or terminal.`)
  }
  if (!out || out === '-') return 'terminal'
  const ext = out.toLowerCase().split('.').pop()
  if (ext === 'png') return 'png'
  if (ext === 'svg') return 'svg'
  throw new Error(`Cannot tell the format from "${out}". Use a .png or .svg extension, or pass --format.`)
}

function parseLevel(v: string | undefined): ErrorCorrectionLevel {
  const level = (v ?? 'M').toUpperCase()
  if (level === 'L' || level === 'M' || level === 'Q' || level === 'H') return level
  throw new Error(`Error-correction level must be L, M, Q, or H (got "${v}").`)
}

function parseInt10(v: string | undefined, fallback: number, name: string): number {
  if (v === undefined) return fallback
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a non-negative integer (got "${v}").`)
  return n
}

async function encodeCommand(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f' },
      ec: { type: 'string', short: 'e' },
      size: { type: 'string', short: 's' },
      margin: { type: 'string', short: 'm' },
      fg: { type: 'string' },
      bg: { type: 'string' },
    },
  })
  if (positionals.length > 1) throw new Error('encode takes at most one text argument. Quote text that contains spaces.')

  const text = await readInputText(positionals[0], io)
  if (text.length === 0) throw new Error('Nothing to encode.')

  const opts: EncodeOptions = {
    errorCorrectionLevel: parseLevel(values.ec),
    width: parseInt10(values.size, DEFAULT_ENCODE_OPTIONS.width, '--size'),
    margin: parseInt10(values.margin, DEFAULT_ENCODE_OPTIONS.margin, '--margin'),
    color: {
      dark: values.fg ?? DEFAULT_ENCODE_OPTIONS.color.dark,
      light: values.bg ?? DEFAULT_ENCODE_OPTIONS.color.light,
    },
  }

  const cap = checkCapacity(text, opts.errorCorrectionLevel)
  if (!cap.ok) {
    throw new Error(
      `Text is ${cap.bytes} bytes; the limit at level ${opts.errorCorrectionLevel} is ${cap.limit}. Shorten it or use a lower level.`,
    )
  }

  const format = pickFormat(values.out, values.format)
  const toStdout = !values.out || values.out === '-'

  if (format === 'terminal') {
    if (!toStdout) throw new Error('The terminal format can only go to stdout.')
    io.stdout(await QRCode.toString(text, { type: 'terminal', small: true, errorCorrectionLevel: opts.errorCorrectionLevel }))
    io.stdout('\n')
    return EXIT_OK
  }

  const payload: string | Uint8Array =
    format === 'svg' ? await encodeToSvg(text, opts) : dataUrlToBytes(await encodeToPngDataUrl(text, opts))

  if (toStdout) {
    io.stdout(payload)
  } else {
    await writeFile(values.out as string, payload)
    io.stderr(`Wrote ${values.out}\n`)
  }
  return EXIT_OK
}

async function decodeCommand(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { json: { type: 'boolean' } },
  })
  if (positionals.length > 1) throw new Error('decode takes at most one image argument.')

  ensureDecoder()
  const bytes = await readInputBytes(positionals[0], io)
  const results = await decodeImage(bytes)

  if (values.json) {
    io.stdout(JSON.stringify(results.map((r) => ({ text: r.text, format: r.format })), null, 2) + '\n')
    return results.length ? EXIT_OK : EXIT_NOT_FOUND
  }
  if (results.length === 0) {
    io.stderr('No QR code found.\n')
    return EXIT_NOT_FOUND
  }
  for (const r of results) io.stdout(r.text + '\n')
  return EXIT_OK
}

/** Runs the CLI. Returns the process exit code instead of exiting, so it can be tested. */
export async function run(argv: string[], io: Io): Promise<number> {
  const [command, ...rest] = argv
  try {
    switch (command) {
      case undefined:
      case '-h':
      case '--help':
      case 'help':
        io.stdout(USAGE)
        return command === undefined ? EXIT_ERROR : EXIT_OK
      case '-v':
      case '--version':
      case 'version':
        io.stdout(`textqr ${version()}\n`)
        return EXIT_OK
      case 'encode':
        return await encodeCommand(rest, io)
      case 'decode':
        return await decodeCommand(rest, io)
      default:
        io.stderr(`Unknown command "${command}".\n\n${USAGE}`)
        return EXIT_ERROR
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    io.stderr(`textqr: ${msg}\n`)
    return EXIT_ERROR
  }
}
