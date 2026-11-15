import type { Chunk } from '@burrowl/knowledge'
import { stems } from './query.ts'

export function dropInvalidCitations(text: string, sourceCount: number): string {
  return text
    .replace(/\s*\[(\d+)\]/g, (m, n: string) => (Number(n) >= 1 && Number(n) <= sourceCount ? m : ''))
    .trim()
}

export function evidenceCoverage(query: string, chunks: Chunk[]): number {
  const wanted = new Set(stems(query))
  if (wanted.size === 0) return 1
  const found = new Set(stems(chunks.map((c) => c.text).join(' ')))
  const names = query.split(/\s+/).filter((w) => /^\p{Lu}/u.test(w)).flatMap((w) => stems(w))
  if (names.some((n) => !found.has(n))) return 0
  let hits = 0
  for (const w of wanted) if (found.has(w)) hits++
  return hits / wanted.size
}

const NUMBER = /\d+(?:[.,\s]\d+)*/g

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

export function keepVerifiedSentences(text: string, evidence: string, allowed: string): string | null {
  const known = [...evidence.matchAll(NUMBER), ...allowed.matchAll(NUMBER)].flatMap((m) => readings(m[0]))
  const verified = (raw: string) => {
    const values = readings(raw)
    if (values.some((v) => Number.isInteger(v) && v <= 10)) return true
    return values.some((v) => known.some((k) => close(v, k)))
  }
  const sentences = text.split(/(?<=[.!?…])\s+|\n+/u)
  const kept = sentences.filter((s) => {
    const numbers = s.replace(/\[\d+\]/g, '').match(NUMBER) ?? []
    return numbers.every(verified)
  })
  const result = kept.join(' ').trim()
  return result && /\p{L}/u.test(result) ? result : null
}
