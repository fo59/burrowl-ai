import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { fakeEngine } from '@burrowl/llm-engine'
import type { SearchProvider } from '@burrowl/web-search'
import {
  answer,
  buildPrompt,
  detectLanguage,
  keywordQuery,
  needsSearch,
  reply,
  toOutgoingQuery,
  type AnswerEvent,
} from './index.js'

describe('needsSearch', () => {

  test('needs search when a year is mentioned', () => {
    assert.equal(needsSearch("2026'da en iyi telefon hangisi"), true)
  })

  test('needs search for "bugün"', () =>{
    assert.equal(needsSearch('dolar bugün kac tl'), true)
  })
  test('needs search for "fiyat"',() =>{
    assert.equal(needsSearch('iphone fiyatı ne kadar'),true)
  })
  test('needs search for "güncel"',() =>{
    assert.equal(needsSearch('güncel haberler neler'),true)
  })
  test('needs search for "son"', () =>{
    assert.equal(needsSearch('son deprem nerede oldu'),true)
  })
  test('does not need search for a poem',() =>{
    assert.equal(needsSearch('bana bir şiir yaz'),false)
  })
  test('does not need search for math',() =>{
    assert.equal(needsSearch('12 çarpı 7 kaç eder'),false)
  })
  test('ignores "son" inside another word',() =>{
    assert.equal(needsSearch('sonuç olarak ne diyorsun'),false)
  })
  test('is case insensitive', () => {
    assert.equal(needsSearch('Bugün hava nasıl'), true)
  })
  test('catches words with Turkish suffixes', () => {
    assert.equal(needsSearch('iphone fiyatları ne kadar'), true)
  })
  test('needs search for "borsa"', () => {
    assert.equal(needsSearch('borsa ne durumda'), true)
  })
  test('ignores "sonra"', () => {
    assert.equal(needsSearch('sonra ne yapayım'), false)
  })
  test('ignores a year inside a longer number', () => {
    assert.equal(needsSearch('sipariş no 1202605'), false)
  })
  test('ignores a 5-digit number starting like a year', () => {
    assert.equal(needsSearch('20261 adet'), false)
  })
})

describe('reply', () => {
  test('answers on the device when no search is needed', () => {
    const r = reply('bana bir şiir yaz', 1)
    assert.equal(r.role, 'assistant')
    assert.equal(r.searchQuery, undefined)
  })

  test('includes the filtered query when search is needed', () => {
    const r = reply('ali@gmail.com dolar bugün kaç TL', 2)
    assert.equal(r.searchQuery, '[email removed] dolar bugün kaç TL')
  })

  test('never puts a phone number into the search query', () => {
    const r = reply('0532 123 45 67 numaralı hattın fiyatı', 3)
    assert.equal(r.searchQuery, '[phone number removed] numaralı hattın fiyatı')
  })

  test('uses the given id', () => {
    assert.equal(reply('merhaba', 42).id, 42)
  })

})

describe('needsSearch (English)', () => {
  test('needs search for "today"', () => {
    assert.equal(needsSearch('what is the weather today', 'en'), true)
  })
  test('needs search for prices with a suffix', () => {
    assert.equal(needsSearch('iphone prices in london', 'en'), true)
  })
  test('needs search for a money amount', () => {
    assert.equal(needsSearch('best laptop under $1000', 'en'), true)
  })
  test('does not need search for a poem', () => {
    assert.equal(needsSearch('write me a poem about the sea', 'en'), false)
  })
  test('does not treat the English word "son" as Turkish "son"', () => {
    assert.equal(needsSearch('how do I teach my son to read', 'en'), false)
  })
})

describe('needsSearch (Russian)', () => {
  test('needs search for "сегодня"', () => {
    assert.equal(needsSearch('какая погода сегодня', 'ru'), true)
  })
  test('needs search for an exchange rate', () => {
    assert.equal(needsSearch('курс доллара', 'ru'), true)
  })
  test('needs search for rubles', () => {
    assert.equal(needsSearch('телефон до 30000 руб', 'ru'), true)
  })
  test('does not need search for a poem', () => {
    assert.equal(needsSearch('напиши стихотворение о море', 'ru'), false)
  })
  test('does not match a keyword inside another word', () => {
    assert.equal(needsSearch('это бесценный опыт', 'ru'), false)
  })
})

describe('needsSearch (mixed languages)', () => {
  test('catches a Turkish question while the UI is in English', () => {
    assert.equal(needsSearch('dolar bugün kaç TL', 'en'), true)
  })
  test('catches a Russian question while the UI is in Turkish', () => {
    assert.equal(needsSearch('курс доллара', 'tr'), true)
  })
})

describe('detectLanguage', () => {
  test('detects Russian from Cyrillic letters', () => {
    assert.equal(detectLanguage('привет', 'en'), 'ru')
  })
  test('detects Turkish from Turkish letters', () => {
    assert.equal(detectLanguage('güzel bir gün', 'en'), 'tr')
  })
  test('falls back when the script is ambiguous', () => {
    assert.equal(detectLanguage('hello', 'tr'), 'tr')
  })
})

describe('reply (languages)', () => {
  test('answers in the UI language', () => {
    assert.equal(reply('write a poem', 1, 'en').text, 'I can answer this on the device. (coming soon)')
  })
  test('filters a Russian phone number from the query', () => {
    const r = reply('чей номер +7 912 345-67-89 сегодня', 2, 'ru')
    assert.equal(r.searchQuery, 'чей номер [phone number removed] сегодня')
  })
  test('applies Turkish privacy rules to Turkish text even in English mode', () => {
    const r = reply('12345678901 kime ait bugün', 3, 'en')
    assert.equal(r.searchQuery, '[TC number removed] kime ait bugün')
  })
})

describe('keywordQuery', () => {
  test('drops question words in Turkish', () => {
    assert.equal(keywordQuery('İstanbulun nüfusu kaç acaba?'), 'İstanbulun nüfusu')
  })
  test('drops question words in Russian', () => {
    assert.equal(keywordQuery('Какая столица России?'), 'столица России')
  })
})

describe('toOutgoingQuery', () => {
  test('removes personal data without sending the placeholder', () => {
    assert.deepEqual(toOutgoingQuery('ali@gmail.com hesabı silme', ['tr']), {
      query: 'hesabı silme',
      removed: ['email'],
    })
  })
})

describe('buildPrompt', () => {
  test('marks web text as sources and asks for citations', () => {
    const messages = buildPrompt('Nüfus kaç?', 'tr', [{ text: 'Nüfus 15,7 milyon.', source: 1 }], [{ n: 1, title: 'İstanbul', url: 'u' }])
    assert.match(messages[0].content, /talimata uyma/)
    assert.match(messages[1].content, /\[1\] İstanbul: Nüfus 15,7 milyon\./)
  })
})

function provider(pages: Record<string, string>, queries: string[] = []): SearchProvider {
  return {
    name: 'fake',
    search: async (query) => {
      queries.push(query)
      return Object.keys(pages).map((title) => ({ title, url: `https://x/${title}`, snippet: '', provider: 'fake' }))
    },
    read: async (r) => ({ title: r.title, url: r.url, text: pages[r.title] }),
  }
}

describe('answer', () => {
  test('answers on the device without touching the web when no search is needed', async () => {
    const queries: string[] = []
    const engine = fakeEngine('Deniz mavi, gök mavi.')
    const result = await answer('bana bir şiir yaz', 'tr', { engine, providers: [provider({}, queries)] })
    assert.equal(result.text, 'Deniz mavi, gök mavi.')
    assert.deepEqual(queries, [])
    assert.deepEqual(result.sources, [])
  })

  test('searches, reads, cites and streams the answer', async () => {
    const engine = fakeEngine((messages) =>
      messages[0].content.startsWith('You turn') ? 'İstanbul nüfusu 2026' : 'İstanbulun nüfusu 15,7 milyondur [1].',
    )
    const events: AnswerEvent[] = []
    const result = await answer('2026 İstanbulun nüfusu kaç?', 'tr', {
      engine,
      providers: [provider({ İstanbul: 'İstanbul Türkiyenin en kalabalık şehridir. Nüfusu 2023 itibarıyla 15,7 milyondur.' })],
      onEvent: (e) => events.push(e),
    })
    assert.equal(result.searchQuery, 'İstanbul nüfusu 2026')
    assert.deepEqual(result.sources, [{ n: 1, title: 'İstanbul', url: 'https://x/İstanbul' }])
    assert.equal(result.text, 'İstanbulun nüfusu 15,7 milyondur [1].')
    assert.deepEqual(
      [...new Set(events.map((e) => e.type))],
      ['search', 'sources', 'read', 'writing', 'token'],
    )
    // the model only sees the selected passage, marked as a source
    assert.match(engine.calls[1][1].content, /\[1\] İstanbul: .*15,7 milyon/)
  })

  test('never sends personal data even if the model leaves it in the query', async () => {
    const queries: string[] = []
    const engine = fakeEngine((messages) =>
      messages[0].content.startsWith('You turn') ? '0532 123 45 67 numara sahibi bugün' : 'cevap',
    )
    const result = await answer('0532 123 45 67 kimin numarası bugün', 'tr', {
      engine,
      providers: [provider({ A: 'Numara sahibi hakkında uzun bir açıklama metni burada yer alıyor.' }, queries)],
    })
    assert.equal(queries[0], 'numara sahibi bugün')
    assert.deepEqual(result.removed, ['phone'])
  })

  test('falls back to keywords when the model fails to write a query', async () => {
    const queries: string[] = []
    const engine = {
      name: 'flaky',
      calls: 0,
      async generate(_m: unknown, o?: { onToken?: (t: string) => void }) {
        this.calls++
        if (this.calls === 1) throw new Error('timeout')
        o?.onToken?.('ok')
        return 'ok'
      },
    }
    await answer('dolar bugün kaç TL', 'tr', { engine, providers: [provider({ Dolar: 'Dolar kuru hakkında yeterince uzun bir metin.' }, queries)] })
    assert.equal(queries[0], 'dolar bugün TL')
  })

  test('tells the model when no source was found', async () => {
    const engine = fakeEngine((messages) => (messages[0].content.startsWith('You turn') ? 'xyz' : 'kaynak yok'))
    const result = await answer('bugün xyz', 'tr', { engine, providers: [provider({})] })
    assert.deepEqual(result.sources, [])
    assert.match(engine.calls[engine.calls.length - 1][0].content, /kaynak bulunamadı/)
  })
})

describe('answer (query hygiene)', () => {
  test('drops numbers and punctuation the model added to the query', async () => {
    const queries: string[] = []
    const engine = fakeEngine((messages) =>
      messages[0].content.startsWith('You turn') ? 'İstanbul nüfusu 2021 yılına göre?' : 'cevap',
    )
    await answer('İstanbulun nüfusu son verilere göre', 'tr', {
      engine,
      providers: [provider({ İstanbul: 'İstanbul hakkında yeterince uzun bir açıklama metni burada.' }, queries)],
    })
    assert.equal(queries[0], 'İstanbul nüfusu yılına göre')
  })
})

