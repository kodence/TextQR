import { useCallback, useState } from 'react'
import { addToHistory, parseHistory, type DecodeResult, type HistoryEntry } from '../core'

const ENABLED_KEY = 'textqr.history.enabled'
const DATA_KEY = 'textqr.history'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage unavailable; history simply does not persist.
  }
}

/** Opt-in, on-device scan history. Off by default; turning it off wipes stored entries. */
export function useHistory() {
  const [enabled, setEnabledState] = useState(() => read(ENABLED_KEY) === '1')
  const [entries, setEntries] = useState<HistoryEntry[]>(() => (read(ENABLED_KEY) === '1' ? parseHistory(read(DATA_KEY)) : []))

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on)
    write(ENABLED_KEY, on ? '1' : null)
    if (!on) {
      setEntries([])
      write(DATA_KEY, null)
    }
  }, [])

  const record = useCallback(
    (results: DecodeResult[]) => {
      if (!enabled || results.length === 0) return
      setEntries((prev) => {
        let next = prev
        const now = Date.now()
        for (const r of results) next = addToHistory(next, { text: r.text, format: r.format, at: now })
        write(DATA_KEY, JSON.stringify(next))
        return next
      })
    },
    [enabled],
  )

  const clear = useCallback(() => {
    setEntries([])
    write(DATA_KEY, null)
  }, [])

  return { enabled, setEnabled, entries, record, clear }
}
