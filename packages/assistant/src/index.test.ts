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
  foldTurkish,
  dropInvalidCitations,
  recentHistory,
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
      http: offline, // no Wikidata: this tests the search-and-read path
    })
    assert.equal(result.searchQuery, 'İstanbul nüfusu 2026')
    assert.deepEqual(result.sources, [{ n: 1, title: 'İstanbul', url: 'https://x/İstanbul' }])
    assert.equal(result.text, 'İstanbulun nüfusu 15,7 milyondur [1].')
    // researched answers are checked before they are shown, so they are not streamed
    assert.deepEqual([...new Set(events.map((e) => e.type))], ['search', 'sources', 'read', 'writing'])
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
    assert.equal(queries[0], 'numara bugün')
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
    await answer('bugün borsa ne durumda', 'tr', { engine, providers: [provider({ Borsa: 'Borsa bugün hakkında yeterince uzun bir metin.' }, queries)] })
    assert.equal(queries[0], 'bugün borsa durumda')
  })

  test('says it found nothing instead of asking the model to guess', async () => {
    const engine = fakeEngine((messages) => (messages[0].content.startsWith('You turn') ? 'xyz' : 'uydurma cevap'))
    const result = await answer('bugün xyz', 'tr', { engine, providers: [provider({})] })
    assert.deepEqual(result.sources, [])
    assert.match(result.text, /güvenilir bir kaynakta cevap bulamadım/)
    assert.equal(engine.calls.length, 1, 'only the query was written; no answer was generated')
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
    assert.equal(queries[0], 'İstanbul nüfusu göre')
  })
})

describe('needsSearch (typed without Turkish letters)', () => {
  test('folds Turkish letters', () => {
    assert.equal(foldTurkish('Güncel Şehir İçin Öner'), 'guncel sehir icin oner')
  })
  test('catches "guncel" written without ü', () => {
    assert.equal(needsSearch('bana guncel telefon oner', 'tr'), true)
  })
  test('catches a recommendation request', () => {
    assert.equal(needsSearch('fiyat performans odakli bir telefon oner', 'tr'), true)
  })
  test('catches "en iyi"', () => {
    assert.equal(needsSearch('en iyi kulaklık hangisi', 'tr'), true)
  })
  test('catches English and Russian recommendations', () => {
    assert.equal(needsSearch('recommend a laptop for students', 'en'), true)
    assert.equal(needsSearch('посоветуй хороший ноутбук', 'ru'), true)
  })
  test('still ignores a plain chat message', () => {
    assert.equal(needsSearch('merhaba nasilsin', 'tr'), false)
  })
})

describe('recentHistory', () => {
  test('keeps the last turns and shortens long answers', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
      content: i === 9 ? 'x'.repeat(800) : `m${i}`,
    }))
    const recent = recentHistory(history)
    assert.equal(recent.length, 6)
    assert.equal(recent[0].content, 'm4')
    assert.equal(recent[5].content.length, 501)
  })
})

describe('answer (conversation)', () => {
  const history = [
    { role: 'user' as const, content: '2026 da fiyat performans telefon oner' },
    { role: 'assistant' as const, content: 'Casper VIA öneririm.' },
  ]

  test('searches again for a follow-up about an earlier search', async () => {
    const queries: string[] = []
    const engine = fakeEngine((m) => (m[0].content.startsWith('You turn') ? '2026 fiyat performans telefon' : 'cevap'))
    await answer('bu cok eski degil mi', 'tr', {
      engine,
      history,
      providers: [provider({ Telefon: 'Akıllı telefonlar hakkında yeterince uzun bir açıklama metni.' }, queries)],
    })
    assert.equal(queries[0], '2026 fiyat performans telefon')
  })

  test('gives earlier turns to the model', async () => {
    const engine = fakeEngine('cevap')
    await answer('tesekkurler', 'tr', { engine, history })
    const messages = engine.calls[0]
    assert.deepEqual(messages.slice(1, 3), history)
    assert.equal(messages[3].content, 'tesekkurler')
  })

  test('does not search after a greeting just because the previous turn did', async () => {
    const queries: string[] = []
    const engine = fakeEngine('Merhaba!')
    await answer('merhaba', 'tr', { engine, history, providers: [provider({}, queries)] })
    assert.deepEqual(queries, [])
  })
})

describe('answer (prompt hygiene)', () => {
  test('tells the model today\'s date', () => {
    const messages = buildPrompt('soru', 'tr', [], null, [], new Date(2026, 10, 12))
    assert.match(messages[0].content, /Bugünün tarihi: 12 Kasım 2026/)
  })

  test('cuts a sentence-long query to six words without question words', async () => {
    const queries: string[] = []
    const engine = fakeEngine((m) =>
      m[0].content.startsWith('You turn')
        ? '2026 yılındaki fiyat performansı odaklı telefon önerisi için ne arıyorsunuz'
        : 'cevap',
    )
    await answer('bana 2026 yilinda fiyat performans odakli telefon oner', 'tr', {
      engine,
      providers: [provider({ T: 'Telefonlar hakkında yeterince uzun bir açıklama metni burada.' }, queries)],
    })
    assert.equal(queries[0], '2026 yılındaki fiyat performansı odaklı telefon')
  })

  test('writes the query from the user\'s words, not from earlier answers', async () => {
    const engine = fakeEngine('sorgu')
    await answer('bugun daha yenisi var mi', 'tr', {
      engine,
      history: [
        { role: 'user', content: 'telefon oner' },
        { role: 'assistant', content: 'Casper Excalibur öneririm.' },
      ],
      providers: [provider({})],
    })
    const rewriteCall = engine.calls[0]
    assert.ok(rewriteCall.every((m) => !m.content.includes('Excalibur')))
    assert.equal(rewriteCall[1].content, 'Önceki soru: telefon oner\nSoru: bugun daha yenisi var mi')
  })
})

describe('answer (topic changes)', () => {
  test('does not mix an unrelated earlier question into a new search', async () => {
    const engine = fakeEngine('sorgu')
    await answer('En son cikan iphone modeli', 'tr', {
      engine,
      history: [
        { role: 'user', content: 'Tl dolar kuru nedir' },
        { role: 'assistant', content: '1 USD = 50 TL [1]' },
      ],
      providers: [provider({})],
    })
    assert.equal(engine.calls[0][1].content, 'En son cikan iphone modeli')
  })
})

describe('dropInvalidCitations', () => {
  test('keeps citations that point to a real source', () => {
    assert.equal(dropInvalidCitations('Ankara [1] başkenttir [2].', 2), 'Ankara [1] başkenttir [2].')
  })
  test('removes citations to sources that do not exist', () => {
    assert.equal(dropInvalidCitations('Model S Plaid [3]', 0), 'Model S Plaid')
    assert.equal(dropInvalidCitations('A [1], B [4].', 2), 'A [1], B.')
  })
})

describe('needsSearch (fact questions)', () => {
  test('searches for facts instead of trusting the model\'s memory', () => {
    assert.equal(needsSearch("İstanbul'un nüfusu kaç?", 'tr'), true)
    assert.equal(needsSearch('Какая столица Казахстана?', 'ru'), true)
    assert.equal(needsSearch('Who wrote War and Peace?', 'en'), true)
    assert.equal(needsSearch('Everest Dağı ne kadar yüksek, yüksekliği kaç metre', 'tr'), true)
  })
  test('does not search for arithmetic, even with "kaç"', () => {
    assert.equal(needsSearch('12 çarpı 7 kaç eder', 'tr'), false)
    assert.equal(needsSearch('how much is 15 times 4', 'en'), false)
  })
  test('does not search for the date (the model is given it)', () => {
    assert.equal(needsSearch('şu an hangi yıldayız', 'tr'), false)
  })
  test('does not search for writing requests', () => {
    assert.equal(needsSearch('kim olduğumu anlatan bir şiir yaz', 'tr'), false)
  })
  test('handles Russian arithmetic, poems, stories and translations', () => {
    assert.equal(needsSearch('сколько будет 5 умножить на 3', 'ru'), false)
    assert.equal(needsSearch('какой стих написал бы Пушкин, напиши стихотворение', 'ru'), false)
    assert.equal(needsSearch('какую сказку расскажешь', 'ru'), false)
    assert.equal(needsSearch('переведи, какое это слово', 'ru'), false)
  })
  test('does not search for small talk', () => {
    assert.equal(needsSearch('nasılsın, ne yapıyorsun', 'tr'), false)
    assert.equal(needsSearch('thanks, that was helpful', 'en'), false)
  })
})

describe('answer (query is chosen from the conversation\'s words)', () => {
  test('drops the answer a small model writes into the query', async () => {
    const queries: string[] = []
    const engine = fakeEngine((m) =>
      m[0].content.startsWith('You turn') ? "Türkiye'nin başkenti Ankara'dır." : 'cevap',
    )
    await answer("Türkiye'nin başkenti neresi?", 'tr', {
      engine,
      providers: [provider({ Ankara: 'Ankara Türkiyenin başkentidir ve İç Anadoluda yer alır.' }, queries)],
      http: offline,
    })
    assert.equal(queries[0], 'Türkiye başkenti')
  })

  test('uses a cited earlier answer to understand a follow-up', async () => {
    const engine = fakeEngine((m) => (m[0].content.startsWith('You turn') ? 'Paris nüfusu' : 'cevap'))
    await answer('peki onun nüfusu kaç', 'tr', {
      engine,
      history: [
        { role: 'user', content: "Fransa'nın başkenti neresi?" },
        { role: 'assistant', content: "Fransa'nın başkenti Paris'tir [1]. Ülkenin en büyük şehridir." },
      ],
      providers: [provider({ Paris: 'Paris hakkında yeterince uzun bir açıklama metni burada.' })],
    })
    assert.match(engine.calls[0][1].content, /Önceki cevap: Fransa'nın başkenti Paris'tir \[1\]\./)
  })

  test('strips Turkish suffixes after an apostrophe', () => {
    assert.equal(keywordQuery("Türkiye'nin başkenti neresi?"), 'Türkiye başkenti')
  })
})

describe('answer (exchange rates)', () => {
  test('answers from the official rate without the model', async () => {
    const engine = fakeEngine('kullanılmamalı')
    const http = {
      fetchImpl: async () => new Response(JSON.stringify({ date: '2026-11-11', rates: { TRY: 50.2588 } })),
    }
    const result = await answer('dolar kuru kaç TL', 'tr', { engine, http })
    assert.equal(result.intent, 'currency')
    assert.match(result.text, /^1 USD = 50,2588 TRY/)
    assert.equal(result.sources[0].title, 'Avrupa Merkez Bankası referans kuru')
    assert.equal(engine.calls.length, 0)
  })
})

const offline = { fetchImpl: async () => new Response('', { status: 404 }) }
