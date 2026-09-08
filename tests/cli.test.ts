import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { EXIT_ERROR, EXIT_NOT_FOUND, EXIT_OK, run, type Io } from '../cli/main'

// A 1x1 white PNG: a valid image with no QR code in it.
const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
)

function makeIo(stdin: Uint8Array = new Uint8Array()) {
  const out: (string | Uint8Array)[] = []
  const err: string[] = []
  const io: Io = {
    stdout: (c) => {
      out.push(c)
    },
    stderr: (c) => {
      err.push(c)
    },
    stdin: async () => stdin,
  }
  const text = () => out.map((c) => (typeof c === 'string' ? c : Buffer.from(c).toString('utf8'))).join('')
  const bytes = () => Buffer.concat(out.map((c) => (typeof c === 'string' ? Buffer.from(c) : Buffer.from(c))))
  return { io, text, bytes, err: () => err.join('') }
}

let dir: string
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textqr-cli-'))
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('textqr encode', () => {
  it('writes a PNG file that decodes back to the text', async () => {
    const file = join(dir, 'a.png')
    const enc = makeIo()
    expect(await run(['encode', 'h\u00e9llo \u{1F389}', '-o', file], enc.io)).toBe(EXIT_OK)
    expect(enc.err()).toContain('Wrote')

    const dec = makeIo()
    expect(await run(['decode', file], dec.io)).toBe(EXIT_OK)
    expect(dec.text()).toBe('h\u00e9llo \u{1F389}\n')
  })

  it('writes SVG to stdout with --format', async () => {
    const t = makeIo()
    expect(await run(['encode', 'svg please', '-o', '-', '--format', 'svg'], t.io)).toBe(EXIT_OK)
    expect(t.text()).toContain('<svg')
  })

  it('renders to the terminal when no output is given', async () => {
    const t = makeIo()
    expect(await run(['encode', 'terminal'], t.io)).toBe(EXIT_OK)
    expect(t.text().length).toBeGreaterThan(50)
    expect(t.text()).toMatch(/[\u2580\u2584\u2588 ]/)
  })

  it('reads text from stdin and strips one trailing newline', async () => {
    const file = join(dir, 'stdin.png')
    const enc = makeIo(Buffer.from('from stdin\n'))
    expect(await run(['encode', '-o', file], enc.io)).toBe(EXIT_OK)
    const dec = makeIo()
    expect(await run(['decode', file], dec.io)).toBe(EXIT_OK)
    expect(dec.text()).toBe('from stdin\n')
  })

  it('emits raw PNG bytes on stdout', async () => {
    const t = makeIo()
    expect(await run(['encode', 'bytes', '-o', '-', '-f', 'png'], t.io)).toBe(EXIT_OK)
    expect(Array.from(t.bytes().subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('rejects text over capacity with a clear message', async () => {
    const t = makeIo()
    expect(await run(['encode', 'x'.repeat(3000), '-o', join(dir, 'big.png')], t.io)).toBe(EXIT_ERROR)
    expect(t.err()).toMatch(/limit/i)
  })

  it('rejects a bad error-correction level and an unknown extension', async () => {
    const a = makeIo()
    expect(await run(['encode', 'x', '--ec', 'Z'], a.io)).toBe(EXIT_ERROR)
    expect(a.err()).toMatch(/L, M, Q, or H/)
    const b = makeIo()
    expect(await run(['encode', 'x', '-o', join(dir, 'x.gif')], b.io)).toBe(EXIT_ERROR)
    expect(b.err()).toMatch(/\.png or \.svg/)
  })
})

describe('textqr decode', () => {
  it('prints JSON with --json', async () => {
    const file = join(dir, 'j.png')
    await run(['encode', 'json me', '-o', file], makeIo().io)
    const t = makeIo()
    expect(await run(['decode', file, '--json'], t.io)).toBe(EXIT_OK)
    expect(JSON.parse(t.text())).toEqual([{ text: 'json me', format: 'QRCode' }])
  })

  it('reads image bytes from stdin', async () => {
    const file = join(dir, 's.png')
    await run(['encode', 'via stdin', '-o', file], makeIo().io)
    const t = makeIo(new Uint8Array(await readFile(file)))
    expect(await run(['decode'], t.io)).toBe(EXIT_OK)
    expect(t.text()).toBe('via stdin\n')
  })

  it('exits 2 when the image has no QR code', async () => {
    const t = makeIo(BLANK_PNG)
    expect(await run(['decode', '-'], t.io)).toBe(EXIT_NOT_FOUND)
    expect(t.err()).toMatch(/no qr code/i)
  })

  it('exits 1 for a missing file', async () => {
    const t = makeIo()
    expect(await run(['decode', join(dir, 'nope.png')], t.io)).toBe(EXIT_ERROR)
    expect(t.err()).toMatch(/ENOENT|no such file/i)
  })
})

describe('textqr general', () => {
  it('prints usage for --help and for no command', async () => {
    const a = makeIo()
    expect(await run(['--help'], a.io)).toBe(EXIT_OK)
    expect(a.text()).toContain('Usage:')
    const b = makeIo()
    expect(await run([], b.io)).toBe(EXIT_ERROR)
    expect(b.text()).toContain('Usage:')
  })

  it('prints the version', async () => {
    const t = makeIo()
    expect(await run(['--version'], t.io)).toBe(EXIT_OK)
    expect(t.text()).toMatch(/^textqr \d+\.\d+\.\d+/)
  })

  it('rejects unknown commands and unknown flags', async () => {
    const a = makeIo()
    expect(await run(['frobnicate'], a.io)).toBe(EXIT_ERROR)
    expect(a.err()).toMatch(/unknown command/i)
    const b = makeIo()
    expect(await run(['encode', 'x', '--nope'], b.io)).toBe(EXIT_ERROR)
  })
})
