import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { needsSearch, reply } from './index.js'

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
