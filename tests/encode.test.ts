import { describe, expect, it } from 'vitest'
import { checkCapacity, effectiveWidth, encodeToPngDataUrl, encodeToSvg, EncodeError, MIN_MODULE_PX, moduleCount } from '../src/core'

describe('checkCapacity', () => {
  it('counts UTF-8 bytes, not characters', () => {
    const c = checkCapacity('h\u00e9llo \u{1F389}', 'M')
    expect(c.chars).toBe(7)
    expect(c.bytes).toBe(11)
    expect(c.ok).toBe(true)
  })

  it('flags text over the byte limit', () => {
    const c = checkCapacity('a'.repeat(3000), 'L')
    expect(c.ok).toBe(false)
    expect(c.over).toBe(47)
  })
})

describe('encode', () => {
  it('produces a PNG data URL', async () => {
    const url = await encodeToPngDataUrl('hello')
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('produces an SVG document', async () => {
    const svg = await encodeToSvg('https://example.com')
    expect(svg).toContain('<svg')
  })

  it('rejects empty input', async () => {
    await expect(encodeToSvg('')).rejects.toBeInstanceOf(EncodeError)
  })

  it('rejects text that is too long', async () => {
    await expect(encodeToSvg('x'.repeat(3000))).rejects.toThrow(/too long/i)
  })
})

describe('effectiveWidth', () => {
  it('keeps the requested width for small codes', () => {
    expect(moduleCount('hello')).toBe(21)
    expect(effectiveWidth('hello', { width: 320, margin: 4 })).toBe(320)
  })

  it('grows the width so large codes stay readable', () => {
    const text = 'a'.repeat(2331)
    expect(moduleCount(text, 'M')).toBe(177)
    expect(effectiveWidth(text, { width: 320, margin: 4, errorCorrectionLevel: 'M' })).toBe((177 + 8) * MIN_MODULE_PX)
  })
})
