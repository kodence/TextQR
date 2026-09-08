import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it } from 'vitest'
import { asHttpUrl, configureDecoder, decodeImage, encodeToPngDataUrl } from '../src/core'

const require = createRequire(import.meta.url)

beforeAll(() => {
  // Load the wasm from node_modules so tests never touch the network.
  const wasm = new Uint8Array(readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm')))
  configureDecoder({ wasmBinary: wasm.buffer })
})

function pngBytes(dataUrl: string): Uint8Array {
  return new Uint8Array(Buffer.from(dataUrl.split(',')[1], 'base64'))
}

async function roundTrip(text: string, level: 'L' | 'M' | 'Q' | 'H' = 'M') {
  const results = await decodeImage(pngBytes(await encodeToPngDataUrl(text, { errorCorrectionLevel: level })))
  expect(results).toHaveLength(1)
  expect(results[0].format).toBe('QRCode')
  expect(results[0].text).toBe(text)
}

describe('encode then decode', () => {
  it('ASCII', () => roundTrip('hello world'))
  it('URL', () => roundTrip('https://example.com/path?q=1&r=two#frag'))
  it('Unicode: accents, emoji, CJK', () => roundTrip('h\u00e9llo \u{1F389} \u4e2d\u6587 \u0421\u0430\u0439\u0442'))
  it('multi-line text', () => roundTrip('line one\nline two\r\n\ttabbed'))
  it('maximum length at level L', () => roundTrip('a'.repeat(2953), 'L'))
  it('maximum length at level H', () => roundTrip('z'.repeat(1273), 'H'))
  it('inverted colours', async () => {
    const url = await encodeToPngDataUrl('inverted', { color: { dark: '#ffffff', light: '#000000' } })
    const results = await decodeImage(pngBytes(url))
    expect(results.map((r) => r.text)).toEqual(['inverted'])
  })
})

describe('decode edge cases', () => {
  it('returns no results for an image without a QR code', async () => {
    const size = 64
    const blank = { data: new Uint8ClampedArray(size * size * 4).fill(255), width: size, height: size } as ImageData
    expect(await decodeImage(blank)).toEqual([])
  })

  it('returns no results for bytes that are not an image', async () => {
    // zxing-wasm treats undecodable bytes as an empty image rather than throwing.
    expect(await decodeImage(new Uint8Array([1, 2, 3, 4]))).toEqual([])
  })
})

describe('asHttpUrl', () => {
  it('accepts http and https', () => {
    expect(asHttpUrl('https://example.com')).toBe('https://example.com/')
    expect(asHttpUrl('  http://a.b/c ')).toBe('http://a.b/c')
  })
  it('rejects other schemes and plain text', () => {
    expect(asHttpUrl('javascript:alert(1)')).toBeNull()
    expect(asHttpUrl('mailto:a@b.c')).toBeNull()
    expect(asHttpUrl('just text')).toBeNull()
  })
})
