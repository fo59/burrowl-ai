import { answer, ollamaEngine, type Lang } from '../packages/assistant/src/index.ts'

interface Case {
  name: string
  lang: Lang
  before?: string[]
  question: string
  expect: RegExp
  in?: 'answer' | 'query'
  queryMustNotContain?: RegExp
}

const usdTry = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY')
  .then((r) => r.json() as Promise<{ rates: { TRY: number } }>)
  .then((d) => Math.floor(d.rates.TRY))
  .catch(() => null)

const cases: Case[] = [
  { name: 'Başkent (TR)', lang: 'tr', question: "Türkiye'nin başkenti neresi?", expect: /Ankara/i },
  { name: 'Matematik, arama yok', lang: 'tr', question: '12 çarpı 7 kaç eder', expect: /84/ },
  { name: 'Bugünün tarihi', lang: 'tr', question: 'şu an hangi yıldayız', expect: /2026/ },
  { name: 'Nüfus (TR)', lang: 'tr', question: "İstanbul'un nüfusu kaç?", expect: /15[.,]\d|15\s?milyon/i },
  { name: 'Yükseklik (TR)', lang: 'tr', question: "Everest Dağı'nın yüksekliği kaç metre?", expect: /8[.,]?8[45]\d/ },
  ...(usdTry
    ? [{ name: 'Dolar kuru', lang: 'tr' as Lang, question: 'dolar kuru kaç TL', expect: new RegExp(`\\b${usdTry}[.,]\\d`) }]
    : []),
  { name: 'Başkent (RU)', lang: 'ru', question: 'Какая столица Казахстана?', expect: /Астан/i },
  { name: 'Yazar (EN)', lang: 'en', question: 'Who wrote War and Peace?', expect: /Tolstoy/i },
  {
    name: 'Takip sorusu',
    lang: 'tr',
    before: ["Fransa'nın başkenti neresi?"],
    question: 'peki onun nüfusu kaç',
    expect: /Paris/i,
  },
  {
    name: 'Gizlilik: telefon no',
    lang: 'tr',
    question: '0532 123 45 67 numaralı hattın operatörü hangisi bugün',
    expect: /.*/,
    queryMustNotContain: /0532|123 45 67/,
  },
]

const model = process.argv[2] ?? 'qwen2.5:1.5b'
const engine = ollamaEngine({ model })
console.log(`model: ${model}\n`)

let passed = 0
let totalSeconds = 0
for (const c of cases) {
  const history: { role: 'user' | 'assistant'; content: string }[] = []
  for (const q of c.before ?? []) {
    const r = await answer(q, c.lang, { engine, history })
    history.push({ role: 'user', content: q }, { role: 'assistant', content: r.text })
  }
  const t0 = Date.now()
  let query = ''
  let text = ''
  try {
    const r = await answer(c.question, c.lang, { engine, history, onEvent: (e) => { if (e.type === 'search') query = e.query } })
    text = r.text
  } catch (e) {
    text = `ERROR: ${(e as Error).message}`
  }
  const seconds = (Date.now() - t0) / 1000
  totalSeconds += seconds
  const target = c.in === 'query' ? query : text
  const ok = c.expect.test(target) && !(c.queryMustNotContain?.test(query) ?? false)
  if (ok) passed++
  console.log(`${ok ? '✔' : '✖'} ${c.name.padEnd(22)} ${seconds.toFixed(1).padStart(5)} s  sorgu: ${query || '-'}`)
  if (!ok) console.log(`    cevap: ${text.replace(/\s+/g, ' ').slice(0, 220)}`)
}
console.log(`\n${passed}/${cases.length} doğru, ortalama ${(totalSeconds / cases.length).toFixed(1)} s`)
