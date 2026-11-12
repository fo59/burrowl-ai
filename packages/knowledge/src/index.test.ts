import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { chunkText, rankChunks, terms } from './index.js'

describe('chunkText', () => {
  test('keeps every chunk under the size limit', () => {
    const text = Array.from({ length: 40 }, (_, i) => `Bu ${i}. cümle biraz uzun bir örnek cümledir.`).join(' ')
    const chunks = chunkText(text, 1, 200)
    assert.ok(chunks.length > 1)
    for (const c of chunks) assert.ok(c.text.length <= 200, `chunk too long: ${c.text.length}`)
  })

  test('remembers which source a chunk came from', () => {
    const chunks = chunkText('Birinci paragraf yeterince uzun bir metin içeriyor burada.\nİkinci paragraf da öyle uzun bir metin.', 3)
    assert.ok(chunks.every((c) => c.source === 3))
  })

  test('drops tiny fragments', () => {
    assert.deepEqual(chunkText('Kısa.', 1), [])
  })
})

describe('terms', () => {
  test('matches suffixed Turkish words by their stem', () => {
    assert.deepEqual(terms('şehrin nüfusu'), terms('şehrinde nüfusunun'))
  })

  test('splits Cyrillic words and drops stopwords', () => {
    assert.deepEqual(terms('Какая столица России?'), ['столи', 'росси'])
  })
})

describe('rankChunks', () => {
  const chunks = [
    { text: 'İstanbul Boğazı Karadeniz ile Marmara Denizini birbirine bağlar.', source: 1 },
    { text: 'İstanbulun nüfusu 2023 itibarıyla yaklaşık 15,7 milyondur.', source: 1 },
    { text: 'Ankara Türkiyenin başkentidir ve İç Anadoluda yer alır.', source: 2 },
  ]

  test('puts the most relevant chunk first', () => {
    assert.equal(rankChunks('İstanbulun nüfusu kaç?', chunks, 1)[0].source, 1)
    assert.match(rankChunks('İstanbulun nüfusu kaç?', chunks, 1)[0].text, /15,7 milyon/)
  })

  test('leaves out chunks with no matching word', () => {
    const ranked = rankChunks('başkent Ankara', chunks, 5)
    assert.deepEqual(ranked.map((c) => c.source), [2])
  })

  test('works for Russian', () => {
    const ru = [
      { text: 'Москва является столицей России и крупнейшим городом страны.', source: 1 },
      { text: 'Байкал — самое глубокое озеро на планете.', source: 2 },
    ]
    assert.equal(rankChunks('столица России', ru, 1)[0].source, 1)
  })
})
