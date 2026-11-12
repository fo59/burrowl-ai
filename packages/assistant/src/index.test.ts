import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { needsSearch, reply, detectLanguage } from './index.js'

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
