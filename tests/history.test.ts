import { describe, expect, it } from 'vitest'
import { addToHistory, HISTORY_MAX, parseHistory } from '../src/core'

const e = (text: string, at = 1) => ({ text, format: 'QRCode', at })

describe('addToHistory', () => {
  it('puts the newest entry first', () => {
    expect(addToHistory([e('a')], e('b')).map((x) => x.text)).toEqual(['b', 'a'])
  })
  it('moves a repeated text to the front instead of duplicating it', () => {
    const list = addToHistory([e('a', 1), e('b', 2)], e('a', 3))
    expect(list.map((x) => x.text)).toEqual(['a', 'b'])
    expect(list[0].at).toBe(3)
  })
  it('caps the list length', () => {
    let list: ReturnType<typeof addToHistory> = []
    for (let i = 0; i < HISTORY_MAX + 5; i++) list = addToHistory(list, e(`t${i}`))
    expect(list).toHaveLength(HISTORY_MAX)
    expect(list[0].text).toBe(`t${HISTORY_MAX + 4}`)
  })
})

describe('parseHistory', () => {
  it('round-trips valid JSON', () => {
    const list = [e('x', 5)]
    expect(parseHistory(JSON.stringify(list))).toEqual(list)
  })
  it('drops malformed entries and tolerates garbage', () => {
    expect(parseHistory('not json')).toEqual([])
    expect(parseHistory('{"a":1}')).toEqual([])
    expect(parseHistory(JSON.stringify([e('ok'), { text: 1 }, null, 'str']))).toEqual([e('ok')])
    expect(parseHistory(null)).toEqual([])
  })
})
