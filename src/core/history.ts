export interface HistoryEntry {
  text: string
  format: string
  /** Unix epoch milliseconds. */
  at: number
}

export const HISTORY_MAX = 50

/** Adds an entry to the front, dropping any older entry with the same text, capped at `max`. */
export function addToHistory(list: readonly HistoryEntry[], entry: HistoryEntry, max = HISTORY_MAX): HistoryEntry[] {
  return [entry, ...list.filter((e) => e.text !== entry.text)].slice(0, max)
}

/** Parses stored JSON defensively: anything malformed yields an empty list. */
export function parseHistory(raw: string | null | undefined): HistoryEntry[] {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
      .filter(
        (e): e is HistoryEntry =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as HistoryEntry).text === 'string' &&
          typeof (e as HistoryEntry).format === 'string' &&
          typeof (e as HistoryEntry).at === 'number',
      )
      .slice(0, HISTORY_MAX)
  } catch {
    return []
  }
}
