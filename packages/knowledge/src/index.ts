export interface Chunk {
  text: string
  // which page (source) the chunk came from; used for [n] citations
  source: number
}

// Splits text on paragraph and sentence boundaries into pieces of at most
// maxChars, so the model only receives a few short, relevant passages.
export function chunkText(text: string, source: number, maxChars = 600): Chunk[] {
  const chunks: Chunk[] = []
  let current = ''
  const push = () => {
    const t = current.trim()
    if (t.length > 40) chunks.push({ text: t, source })
    current = ''
  }
  for (const paragraph of text.split(/\n+/)) {
    const sentences = paragraph.length > maxChars ? paragraph.split(/(?<=[.!?…])\s+/u) : [paragraph]
    for (const sentence of sentences) {
      if (current.length + sentence.length + 1 > maxChars) push()
      current += (current ? ' ' : '') + sentence
    }
    if (current.length > maxChars / 2) push()
  }
  push()
  return chunks
}

// Very common words carry no meaning for matching.
const STOPWORDS = new Set([
  // tr
  've', 'ile', 'bir', 'bu', 'şu', 'o', 'da', 'de', 'mi', 'mı', 'mu', 'mü', 'ne', 'için', 'gibi', 'çok', 'daha',
  'olan', 'olarak', 'nedir', 'nasıl', 'kaç', 'hangi', 'hangisi', 'kim', 'kimdir', 'ise', 'en',
  // en
  'the', 'a', 'an', 'of', 'and', 'or', 'is', 'are', 'was', 'were', 'to', 'in', 'on', 'for', 'with', 'what',
  'who', 'how', 'which', 'it', 'its', 'by', 'as', 'at', 'be', 'that', 'this', 'from',
  // ru
  'и', 'в', 'на', 'с', 'по', 'не', 'что', 'как', 'это', 'кто', 'какой', 'какая', 'какие', 'для', 'из', 'о',
  'от', 'до', 'ли', 'же', 'а', 'но', 'или', 'у', 'к',
])

// Lowercases, splits on anything that is not a letter or digit (any script) and
// cuts words to their first 5 letters so suffixed forms match (şehri / şehrin,
// population / populations, столица / столицы).
export function terms(text: string): string[] {
  return text
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map((w) => (/^\p{N}+$/u.test(w) ? w : w.slice(0, 5)))
}

// Ranks chunks with BM25, a classic keyword relevance score. It is fast enough
// to run on a phone in milliseconds, unlike a neural model.
export function rankChunks(question: string, chunks: Chunk[], k = 5): Chunk[] {
  const q = [...new Set(terms(question))]
  if (q.length === 0 || chunks.length === 0) return chunks.slice(0, k)

  const docs = chunks.map((c) => terms(c.text))
  const avgLen = docs.reduce((n, d) => n + d.length, 0) / docs.length || 1
  const df = new Map<string, number>()
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1)

  const K1 = 1.2
  const B = 0.75
  const N = docs.length
  const scored = docs.map((d, i) => {
    const tf = new Map<string, number>()
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1)
    let score = 0
    for (const t of q) {
      const f = tf.get(t)
      if (!f) continue
      const n = df.get(t) ?? 0
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.length) / avgLen)))
    }
    return { chunk: chunks[i], score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.chunk)
}
