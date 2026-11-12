import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  wikidataFact,
  wikidataSearch,
  currentWeather,
  fetchRate,
  geocode,
  rateRequest,
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

describe('readPages (cache)', () => {
  test('reuses pages read earlier in the conversation', async () => {
    let reads = 0
    const provider: SearchProvider = {
      name: 'p',
      search: async () => [],
      read: async (r) => {
        reads++
        return { title: r.title, url: r.url, text: 'metin' }
      },
    }
    const cache = new Map()
    const results = [{ title: 'A', url: 'u', snippet: '', provider: 'p' }]
    await readPages(results, [provider], { lang: 'tr', cache })
    const again = await readPages(results, [provider], { lang: 'tr', cache })
    assert.equal(reads, 1)
    assert.equal(again[0].text, 'metin')
  })
})

describe('fetchRate', () => {
  test('returns the official rate as data', async () => {
    const rate = await fetchRate({ base: 'USD', target: 'TRY' }, {
      fetchImpl: fakeFetch({ frankfurter: { date: '2026-11-11', rates: { TRY: 50.2588 } } }),
    })
    assert.deepEqual(rate, {
      kind: 'rate', base: 'USD', target: 'TRY', rate: 50.2588, date: '2026-11-11',
      url: 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY',
    })
  })
  test('knows the rouble is not published', async () => {
    const rate = await fetchRate({ base: 'TRY', target: 'RUB' }, { fetchImpl: fakeFetch({}) })
    assert.equal(rate?.kind, 'unpublished')
  })
  test('reads the pair from a question', () => {
    assert.deepEqual(rateRequest('dolar kaç TL', 'tr'), { base: 'USD', target: 'TRY' })
    assert.equal(rateRequest('iphone fiyatı', 'tr'), null)
  })
})

describe('geocode', () => {
  const results = {
    results: [
      { name: 'Kazan', country: 'Türkiye', latitude: 40.2, longitude: 32.7, population: 23889 },
      { name: 'Kazan', country: 'Rusya', latitude: 55.8, longitude: 49.1, population: 1243500 },
      { name: 'Kazanlak', country: 'Bulgaristan', latitude: 42.6, longitude: 25.4, population: 50000 },
    ],
  }
  test('picks the largest place with exactly that name', async () => {
    const place = await geocode('Kazan', 'tr', { fetchImpl: fakeFetch({ geocoding: results }) })
    assert.equal(place?.country, 'Rusya')
  })
  test('matches İstanbul when typed as Istanbul', async () => {
    const place = await geocode('Istanbul', 'tr', {
      fetchImpl: fakeFetch({ geocoding: { results: [{ name: 'İstanbul', country: 'Türkiye', latitude: 41, longitude: 29, population: 15000000 }] } }),
    })
    assert.equal(place?.name, 'İstanbul')
  })
  test('rejects places that only look similar', async () => {
    const place = await geocode('Москве', 'ru', {
      fetchImpl: fakeFetch({ geocoding: { results: [{ name: 'Москверо', latitude: 35, longitude: -103 }] } }),
    })
    assert.equal(place, null)
  })
})

describe('currentWeather', () => {
  test('returns the current conditions as data', async () => {
    const weather = await currentWeather(
      { name: 'Moskova', country: 'Rusya', latitude: 55.75, longitude: 37.62, population: 1 },
      {
        fetchImpl: fakeFetch({
          forecast: { current: { time: '2026-11-12T20:15', temperature_2m: 1.5, apparent_temperature: -0.9, weather_code: 3, wind_speed_10m: 2.3 } },
        }),
      },
    )
    assert.equal(weather.temperature, 1.5)
    assert.equal(weather.code, 3)
    assert.match(weather.url, /latitude=55\.75/)
  })
})

describe('wikidata', () => {
  const routes = {
    wbsearchentities: { search: [{ id: 'Q43', label: 'Türkiye', description: 'Batı Asya ülkesi' }] },
    'property=P36': {
          claims: {
            P36: [{ rank: 'normal', mainsnak: { datavalue: { type: 'wikibase-entityid', value: { id: 'Q3640' } } } }],
          },
    },
    'property=P1082': {
          claims: {
            P1082: [
              { rank: 'normal', mainsnak: { datavalue: { type: 'quantity', value: { amount: '+84680273', unit: '1' } } }, qualifiers: { P585: [{ datavalue: { value: { time: '+2021-12-31T00:00:00Z' } } }] } },
              { rank: 'normal', mainsnak: { datavalue: { type: 'quantity', value: { amount: '+85372377', unit: '1' } } }, qualifiers: { P585: [{ datavalue: { value: { time: '+2023-12-31T00:00:00Z' } } }] } },
            ],
          },
    },
    'property=P50': { claims: {} },
    'ids=Q3640&props=labels': { entities: { Q3640: { labels: { tr: { value: 'Ankara' } } } } },
  }

  test('finds an entity even when typed without Turkish letters', async () => {
    const found = await wikidataSearch('Turkiye', 'tr', { fetchImpl: fakeFetch(routes) })
    assert.equal(found[0].id, 'Q43')
  })

  test('reads an item value with its label', async () => {
    const http = { fetchImpl: fakeFetch(routes) }
    const fact = await wikidataFact([{ id: 'Q43', label: 'Türkiye', description: '' }], ['P36'], 'tr', http)
    assert.deepEqual(fact?.values, [{ kind: 'item', id: 'Q3640', label: 'Ankara' }])
    assert.equal(fact?.url, 'https://www.wikidata.org/wiki/Q43')
  })

  test('takes the most recent population', async () => {
    const http = { fetchImpl: fakeFetch(routes) }
    const fact = await wikidataFact([{ id: 'Q43', label: 'Türkiye', description: '' }], ['P1082'], 'tr', http)
    assert.deepEqual(fact?.values, [{ kind: 'quantity', amount: 85372377, unit: null, date: '2023-12-31' }])
  })

  test('returns null when no entity has the property', async () => {
    const http = { fetchImpl: fakeFetch(routes) }
    assert.equal(await wikidataFact([{ id: 'Q43', label: 'Türkiye', description: '' }], ['P50'], 'tr', http), null)
  })
})

