import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  currenciesIn,
  exchangeRates,
  extractText,
  isolatedFetch,
  readPages,
  searchAll,
  stripTags,
  wikipedia,
  type FetchLike,
  type SearchProvider,
} from './index.js'

function fakeFetch(routes: Record<string, unknown>, calls: { url: string; init?: RequestInit }[] = []): FetchLike {
  return async (url, init) => {
    calls.push({ url, init })
    const key = Object.keys(routes).find((k) => url.includes(k))
    if (!key) return new Response('not found', { status: 404 })
    const body = routes[key]
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 })
  }
}

describe('isolatedFetch', () => {
  test('sends no cookies and no referrer', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    await isolatedFetch('https://example.org', { fetchImpl: fakeFetch({ example: 'ok' }, calls) })
    assert.equal(calls[0].init?.credentials, 'omit')
    assert.equal(calls[0].init?.referrerPolicy, 'no-referrer')
    assert.equal(calls[0].init?.cache, 'no-store')
  })

  test('gives up after the time limit', async () => {
    const slow: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })
    await assert.rejects(isolatedFetch('https://slow.example', { fetchImpl: slow, timeoutMs: 20 }))
  })

  test('cuts very long pages', async () => {
    const text = await isolatedFetch('https://big.example', {
      fetchImpl: fakeFetch({ big: 'x'.repeat(100) }),
      maxChars: 10,
    })
    assert.equal(text.length, 10)
  })
})

describe('extractText', () => {
  test('keeps paragraphs and drops scripts, menus and footers', () => {
    const html = `<html><head><title>T</title><script>alert("x")</script></head><body>
      <nav>Menü Ana sayfa</nav><p>Birinci &amp; paragraf.</p><p>İkinci paragraf.</p>
      <footer>Telif</footer></body></html>`
    assert.equal(extractText(html), 'T\nBirinci & paragraf.\nİkinci paragraf.')
  })

  test('decodes numeric entities', () => {
    assert.equal(stripTags('<b>caf&#233; &#x41;</b>'), 'café A')
  })
})

describe('wikipedia', () => {
  test('searches the Wikipedia of the given language', async () => {
    const calls: { url: string }[] = []
    const provider = wikipedia({
      fetchImpl: fakeFetch(
        { 'list=search': { query: { search: [{ title: 'Москва', snippet: '<span>столица</span> России' }] } } },
        calls,
      ),
    })
    const results = await provider.search('столица России', { lang: 'ru' })
    assert.ok(calls[0].url.startsWith('https://ru.wikipedia.org/w/api.php?'))
    assert.deepEqual(results, [
      {
        title: 'Москва',
        url: 'https://ru.wikipedia.org/wiki/%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0',
        snippet: 'столица России',
        provider: 'wikipedia',
      },
    ])
  })

  test('reads the plain text of a page', async () => {
    const provider = wikipedia({
      fetchImpl: fakeFetch({ 'prop=extracts': { query: { pages: { '1': { title: 'İstanbul', extract: 'İstanbul en kalabalık şehirdir.' } } } } }),
    })
    const page = await provider.read!({ title: 'İstanbul', url: 'u', snippet: '', provider: 'wikipedia' }, { lang: 'tr' })
    assert.deepEqual(page, { title: 'İstanbul', url: 'u', text: 'İstanbul en kalabalık şehirdir.' })
  })
})

const ok = (name: string, urls: string[]): SearchProvider => ({
  name,
  search: async () => urls.map((url) => ({ title: url, url, snippet: '', provider: name })),
})
const broken: SearchProvider = {
  name: 'broken',
  search: async () => {
    throw new Error('blocked')
  },
}

describe('searchAll', () => {
  test('moves on quietly when a source fails', async () => {
    const results = await searchAll([broken, ok('a', ['u1', 'u2'])], 'q', { lang: 'tr' })
    assert.deepEqual(results.map((r) => r.url), ['u1', 'u2'])
  })

  test('removes duplicate pages and respects the limit', async () => {
    const results = await searchAll([ok('a', ['u1', 'u2']), ok('b', ['u2', 'u3', 'u4'])], 'q', { lang: 'tr', limit: 3 })
    assert.deepEqual(results.map((r) => r.url), ['u1', 'u2', 'u3'])
  })
})

describe('readPages', () => {
  test('skips pages that fail and reports progress', async () => {
    const progress: number[] = []
    const provider: SearchProvider = {
      name: 'p',
      search: async () => [],
      read: async (r) => {
        if (r.url === 'bad') throw new Error('timeout')
        return { title: r.title, url: r.url, text: 'text ' + r.url }
      },
    }
    const pages = await readPages(
      [
        { title: 'A', url: 'good', snippet: '', provider: 'p' },
        { title: 'B', url: 'bad', snippet: '', provider: 'p' },
      ],
      [provider],
      { lang: 'tr', onRead: (done) => progress.push(done) },
    )
    assert.deepEqual(pages, [{ title: 'A', url: 'good', text: 'text good' }])
    assert.deepEqual(progress.sort(), [1, 2])
  })
})

describe('exchangeRates', () => {
  test('finds currencies in order, in any language and spelling', () => {
    assert.deepEqual(currenciesIn('dolar kaç TL'), ['USD', 'TRY'])
    assert.deepEqual(currenciesIn('курс евро к рублю'), ['EUR', 'RUB'])
    assert.deepEqual(currenciesIn('guncel tl ruble kac kur'), ['TRY', 'RUB'])
    assert.deepEqual(currenciesIn('iphone fiyatı'), [])
  })

  test('uses the home currency when only one is named', async () => {
    const results = await exchangeRates().search('euro kuru', { lang: 'tr' })
    assert.equal(results[0].title, 'EUR/TRY (ECB)')
  })

  test('turns the rate into a citable source', async () => {
    const provider = exchangeRates({
      fetchImpl: fakeFetch({ frankfurter: { date: '2026-11-11', base: 'USD', rates: { TRY: 50.229 } } }),
    })
    const [result] = await provider.search('dolar TL', { lang: 'tr' })
    const page = await provider.read!(result, { lang: 'tr' })
    assert.match(page!.text, /2026-11-11: 1 USD = 50.229 TRY/)
  })

  test('says honestly that the rouble is not published', async () => {
    const provider = exchangeRates({ fetchImpl: fakeFetch({}) })
    const [result] = await provider.search('tl ruble', { lang: 'tr' })
    const page = await provider.read!(result, { lang: 'tr' })
    assert.match(page!.text, /does not publish RUB/)
  })

  test('ignores the English word "try"', async () => {
    assert.deepEqual(await exchangeRates().search('how to try yoga at home', { lang: 'en' }), [])
  })

  test('ignores questions without a currency', async () => {
    assert.deepEqual(await exchangeRates().search('en iyi telefon', { lang: 'tr' }), [])
  })
})

