import type { Chunk } from '@burrowl/knowledge'
import { stems } from './query.ts'

// Small models sometimes cite [3] when there are two sources, or none at all.
// A citation the user cannot follow is worse than no citation, so it is removed.
export function dropInvalidCitations(text: string, sourceCount: number): string {
  return text
    .replace(/\s*\[(\d+)\]/g, (m, n: string) => (Number(n) >= 1 && Number(n) <= sourceCount ? m : ''))
    .trim()
}

// Share of the query's words that appear in the passages handed to the model.
// Low coverage means the search found pages about something else (asking for
// "2026 telefon" and getting the 112 emergency number article).
export function evidenceCoverage(query: string, chunks: Chunk[]): number {
  const wanted = new Set(stems(query))
  if (wanted.size === 0) return 1
  const found = new Set(stems(chunks.map((c) => c.text).join(' ')))
  let hits = 0
  for (const w of wanted) if (found.has(w)) hits++
  return hits / wanted.size
}

const NUMBER = /\d+(?:[.,\s]\d+)*/g

// A written number can mean different values ("8.849" is 8849 in Turkish and
// 8.849 in English), so every reading is kept.
function readings(raw: string): number[] {
  const s = raw.replace(/\s/g, '')
  const out = new Set<number>()
  out.add(Number(s.replace(/[.,]/g, '')))
  out.add(Number(s.replace(/\./g, '').replace(',', '.')))
  out.add(Number(s.replace(/,/g, '')))
  return [...out].filter((n) => Number.isFinite(n))
}

function close(a: number, b: number): boolean {
  if (a === b) return true
  return Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 0.01
}

// Drops sentences that contain a number not found in the sources (or the
// question, or today's date). The model may phrase things freely, but it may
// not invent figures. Returns null when nothing verifiable is left.
export function keepVerifiedSentences(text: string, evidence: string, allowed: string): string | null {
  const known = [...evidence.matchAll(NUMBER), ...allowed.matchAll(NUMBER)].flatMap((m) => readings(m[0]))
  const verified = (raw: string) => {
    const values = readings(raw)
    // small counts like "3 öneri" are wording, not facts
    if (values.some((v) => Number.isInteger(v) && v <= 10)) return true
    return values.some((v) => known.some((k) => close(v, k)))
  }
  const sentences = text.split(/(?<=[.!?…])\s+|\n+/u)
  const kept = sentences.filter((s) => {
    // citation numbers like [1] are not facts
    const numbers = s.replace(/\[\d+\]/g, '').match(NUMBER) ?? []
    return numbers.every(verified)
  })
  const result = kept.join(' ').trim()
  return result && /\p{L}/u.test(result) ? result : null
}
