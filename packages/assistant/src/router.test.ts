import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { fakeEngine } from '@burrowl/llm-engine'
import {
  answer,
  detectIntent,
  evaluateMath,
  evidenceCoverage,
  keepVerifiedSentences,
  placeCandidates,
  cleanOutput,
  factRequest,
  type Intent,
} from './index.js'

const kind = (message: string, history: { role: 'user' | 'assistant'; content: string }[] = []): Intent['kind'] =>
  detectIntent(message, history, 'tr').kind

// Messages taken from real test conversations.
describe('detectIntent', () => {
  test('small talk', () => {
    assert.equal(kind('merhaba'), 'chat')
  })
  test('facts', () => {
    assert.equal(kind('Turkiyenin baskenti'), 'fact')
  })
  test('recommendations', () => {
    assert.equal(kind('2026 yili icin bana telefon oner ne alabilirim'), 'recommend')
  })
  test('date and time', () => {
    assert.equal(kind('hangi yildayiz'), 'datetime')
  })
  test('weather, typed without Turkish letters', () => {
    assert.equal(kind('Istanbul da suan hava nasil'), 'weather')
    assert.equal(kind('bugun kazanda hava kac derece?'), 'weather')
    assert.equal(kind('bugun moskova hava durumu anlik'), 'weather')
  })
  test('a translation request without the text waits for the next message', () => {
    const asking = 'sana bir kac cumle versem ruscaya cevirebilir misn'
    assert.deepEqual(detectIntent(asking, [], 'tr'), { kind: 'translate', text: null, target: 'Russian' })
    const next = detectIntent('bugun hava soguk moskovada 2 derece', [
      { role: 'user', content: asking },
      { role: 'assistant', content: 'Tabii. Çevirmemi istediğin metni yaz.' },
    ], 'tr')
    assert.deepEqual(next, { kind: 'translate', text: 'bugun hava soguk moskovada 2 derece', target: 'Russian' })
  })
  test('a translation request with the text in it', () => {
    assert.deepEqual(detectIntent('bu cumleyi ruscaya cevir bugun hava soguk moskovada 2 derece', [], 'tr'), {
      kind: 'translate',
      text: 'bugun hava soguk moskovada 2 derece',
      target: 'Russian',
    })
  })
  test('questions about what the assistant did', () => {
    assert.equal(kind('ceviri yaparken internetten yararlandi mi'), 'meta')
    assert.equal(kind('intetnetten mi buldun?'), 'chat')
  })
  test('"wrong" re-checks the last real question', () => {
    const history = [
      { role: 'user' as const, content: 'peki moskovada hava kac derece?' },
      { role: 'assistant' as const, content: 'Moskova: 15°C' },
      { role: 'user' as const, content: 'yanlis' },
      { role: 'assistant' as const, content: '...' },
    ]
    assert.deepEqual(detectIntent('yanlis', history, 'tr'), { kind: 'correction', previous: 'peki moskovada hava kac derece?' })
  })
  test('advice', () => {
    assert.equal(kind('sevgilimden ayrildim taktik ver'), 'advice')
    assert.equal(kind('komsum kapisinin onune cok cop koyuyor rahatsiz oluyorum bunu nasil cozerim'), 'advice')
  })
  test('writing', () => {
    assert.equal(kind('denizi anlatan bir şiir yaz'), 'write')
  })
  test('arithmetic', () => {
    assert.equal(kind('12 çarpı 7 kaç eder'), 'math')
  })
  test('rates', () => {
    assert.equal(kind('guncel tl ruble kac kur?'), 'currency')
  })
})

describe('placeCandidates', () => {
  test('removes Turkish case endings', () => {
    assert.equal(placeCandidates('bugun kazanda hava kac derece?')[0], 'Kazan')
    assert.equal(placeCandidates('peki moskovada hava kac derece?')[0], 'Moskova')
    assert.equal(placeCandidates('Istanbul da suan hava nasil')[0], 'Istanbul')
  })
  test('removes Russian case endings', () => {
    assert.equal(placeCandidates('какая погода в Москве')[0], 'Москва')
  })
  test('returns nothing when no place is named', () => {
    assert.deepEqual(placeCandidates('hava nasil'), [])
  })
})

describe('evaluateMath', () => {
  test('calculates instead of asking the model', () => {
    assert.equal(evaluateMath('12 çarpı 7 kaç eder')?.value, 84)
    assert.equal(evaluateMath('(3 + 4) * 2')?.value, 14)
    assert.equal(evaluateMath('2,5 x 4')?.value, 10)
    assert.equal(evaluateMath('сколько будет 5 умножить на 3')?.value, 15)
  })
  test('ignores numbers in ordinary sentences', () => {
    assert.equal(evaluateMath('iphone 15 ile 16 arasındaki fark - hangisi iyi'), null)
    assert.equal(evaluateMath('2026 yılı için telefon'), null)
  })
})

describe('evidenceCoverage', () => {
  test('is low when the passages are about something else', () => {
    const chunks = [{ text: '112 acil çağrı numarasıdır; telefon ile ulaşılır.', source: 1 }]
    assert.ok(evidenceCoverage('2026 telefon', chunks) < 1)
    assert.equal(evidenceCoverage('Türkiye başkenti', [{ text: 'Ankara, Türkiye Cumhuriyetinin başkentidir.', source: 1 }]), 1)
  })
})

describe('keepVerifiedSentences', () => {
  test('drops sentences with numbers that are not in the sources (even in a model name)', () => {
    const text = 'Model S23 Ultra öneririm. Fiyatı 999 TL. Nüfus 15,7 milyondur [1].'
    assert.equal(keepVerifiedSentences(text, 'İstanbul nüfusu 15,7 milyon.', ''), 'Nüfus 15,7 milyondur [1].')
  })
  test('accepts the same number written differently', () => {
    assert.equal(keepVerifiedSentences('Everest 8.849 metredir.', 'Yüksekliği 8849 m.', ''), 'Everest 8.849 metredir.')
  })
  test('returns null when nothing verifiable is left', () => {
    assert.equal(keepVerifiedSentences('Bugün 15 derece.', 'Hava durumu hakkında genel bilgi.', ''), null)
  })
})

// Fake HTTP for the data tools, so tests never touch the network.
function http(routes: Record<string, unknown>) {
  return {
    fetchImpl: async (url: string) => {
      const key = Object.keys(routes).find((k) => url.includes(k))
      return key ? new Response(JSON.stringify(routes[key])) : new Response('', { status: 404 })
    },
  }
}

describe('answer (tools)', () => {
  test('weather comes from Open-Meteo, not from the model', async () => {
    const engine = fakeEngine('kullanılmamalı')
    const sent: string[] = []
    const result = await answer('bugun kazanda hava kac derece?', 'tr', {
      engine,
      onEvent: (e) => { if (e.type === 'search') sent.push(e.query) },
      http: http({
        geocoding: { results: [{ name: 'Kazan', country: 'Rusya', latitude: 55.8, longitude: 49.1, population: 1243500 }] },
        forecast: { current: { time: '2026-11-12T20:15', temperature_2m: 1.5, apparent_temperature: -0.9, weather_code: 3, wind_speed_10m: 2.3 } },
      }),
    })
    assert.equal(result.text, 'Kazan: şu an 1,5°C, kapalı. Hissedilen -0,9°C, rüzgâr 2 km/sa [1].')
    assert.deepEqual(sent, ['Kazan'], 'only the place name went out')
    assert.equal(engine.calls.length, 0)
  })

  test('asks for the city when none is named', async () => {
    const result = await answer('hava nasil', 'tr', { engine: fakeEngine('x') })
    assert.equal(result.text, 'Hangi şehrin hava durumunu istersin?')
  })

  test('arithmetic is exact', async () => {
    const result = await answer('12 çarpı 7 kaç eder', 'tr', { engine: fakeEngine('85') })
    assert.equal(result.text, '12 * 7 = 84')
  })

  test('the date comes from the clock', async () => {
    const result = await answer('hangi yildayiz', 'tr', { engine: fakeEngine('2023'), now: new Date(2026, 10, 12, 18, 5) })
    assert.match(result.text, /12 Kasım 2026/)
  })

  test('"did you use the internet?" is answered from what really happened', async () => {
    const engine = fakeEngine('uydurma')
    const local = await answer('ceviri yaparken internetten yararlandi mi', 'tr', { engine, lastTurn: { sources: 0, removed: [] } })
    assert.match(local.text, /^Hayır/)
    const searched = await answer('internetten yararlandin mi', 'tr', {
      engine,
      lastTurn: { searchQuery: 'Türkiye başkenti', sources: 3, removed: ['phone'] },
    })
    assert.match(searched.text, /"Türkiye başkenti".*3 kaynak.*telefon/)
    assert.equal(engine.calls.length, 0)
  })

  test('translation never searches and asks for the text first', async () => {
    const engine = fakeEngine('Сегодня в Москве холодно, 2 градуса.')
    const ask = await answer('sana bir kac cumle versem ruscaya cevirebilir misn', 'tr', { engine })
    assert.equal(ask.text, 'Tabii. Çevirmemi istediğin metni yaz.')
    const sent: string[] = []
    const done = await answer('bugun hava soguk moskovada 2 derece', 'tr', {
      engine,
      history: [
        { role: 'user', content: 'sana bir kac cumle versem ruscaya cevirebilir misn' },
        { role: 'assistant', content: ask.text },
      ],
      onEvent: (e) => { if (e.type === 'search') sent.push(e.query) },
    })
    assert.equal(done.intent, 'translate')
    assert.deepEqual(sent, [])
    assert.match(engine.calls[0][0].content, /into Russian/)
  })

  test('advice is answered without earlier turns the model could copy', async () => {
    const engine = fakeEngine('Öneriler...')
    await answer('komsum kapisinin onune cok cop koyuyor rahatsiz oluyorum bunu nasil cozerim', 'tr', {
      engine,
      history: [
        { role: 'user', content: 'sevgilimden ayrildim taktik ver' },
        { role: 'assistant', content: 'Sevgili: ...' },
      ],
    })
    assert.equal(engine.calls[0].length, 2)
    assert.match(engine.calls[0][0].content, /3-5 kısa ve uygulanabilir öneri/)
  })

  test('the web switch off blocks tools that need the internet', async () => {
    const result = await answer('Istanbul da suan hava nasil', 'tr', { engine: fakeEngine('x'), web: 'off' })
    assert.match(result.text, /Web araması kapalı/)
  })
})

describe('cleanOutput', () => {
  test('removes words in scripts none of our languages use', () => {
    assert.equal(cleanOutput('profesyonel bir心理咨询 uzmana başvurun'), 'profesyonel bir uzmana başvurun')
  })
})

describe('answer (correction)', () => {
  test('"wrong" after a weather answer asks the weather service again', async () => {
    const calls: string[] = []
    const result = await answer('yanlis', 'tr', {
      engine: fakeEngine('x'),
      history: [
        { role: 'user', content: 'peki moskovada hava kac derece?' },
        { role: 'assistant', content: 'Moskova: şu an 1,5°C' },
      ],
      http: {
        fetchImpl: async (url: string) => {
          calls.push(url)
          return new Response(JSON.stringify(url.includes('geocoding')
            ? { results: [{ name: 'Moskova', country: 'Rusya', latitude: 55.75, longitude: 37.62, population: 13000000 }] }
            : { current: { time: '2026-11-12T20:15', temperature_2m: 1.5, apparent_temperature: -0.9, weather_code: 3, wind_speed_10m: 2.3 } }))
        },
      },
    })
    assert.match(result.text, /^Tekrar kontrol ettim: Moskova: şu an 1,5°C/)
    assert.ok(calls.some((u) => u.includes('forecast')))
  })
})


describe('factRequest', () => {
  test('finds the property and the name in three languages', () => {
    assert.deepEqual(factRequest('Turkiyenin baskenti')?.subjects[0], 'Turkiye')
    assert.equal(factRequest('Everest dağının yüksekliği ne kadar')?.subjects[0], 'Everest')
    assert.equal(factRequest('Savaş ve Barış kitabının yazarı kim')?.subjects[0], 'Savaş ve Barış')
    assert.equal(factRequest('What is the capital of Kazakhstan')?.subjects[0], 'Kazakhstan')
    assert.equal(factRequest('Какая столица Казахстана')?.subjects[0], 'Казахстан')
  })
  test('keeps names that only look like they have a suffix', () => {
    assert.ok(factRequest('Berlinin nüfusu kaç')?.subjects.includes('Berlin'))
  })
  test('a pronoun means the earlier answer', () => {
    assert.deepEqual(factRequest('peki onun nüfusu kaç', 'Fransa — başkent: Paris [1].')?.subjects, ['Paris'])
    assert.equal(factRequest('peki onun nüfusu kaç', 'Bilmiyorum.'), null)
  })
  test('ignores other questions', () => {
    assert.equal(factRequest('merhaba'), null)
  })
})

describe('answer (Wikidata facts)', () => {
  test('a capital comes from Wikidata without the model', async () => {
    const engine = fakeEngine('Hedi Türki')
    const result = await answer('Turkiyenin baskenti', 'tr', {
      engine,
      http: http({
        wbsearchentities: { search: [{ id: 'Q43', label: 'Türkiye', description: 'ülke' }] },
        'property=P36': { claims: { P36: [{ rank: 'normal', mainsnak: { datavalue: { type: 'wikibase-entityid', value: { id: 'Q3640' } } } }] } },
        'props=labels': { entities: { Q3640: { labels: { tr: { value: 'Ankara' } } } } },
      }),
    })
    assert.equal(result.text, 'Türkiye — başkent: Ankara [1].')
    assert.equal(result.sources[0].url, 'https://www.wikidata.org/wiki/Q43')
    assert.equal(engine.calls.length, 0)
  })
})
