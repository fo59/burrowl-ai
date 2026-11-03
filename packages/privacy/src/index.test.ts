import { test } from 'node:test'
import assert from 'node:assert/strict'
import { removeTcNumber } from './index.js'

test('removes a TC number inside a sentence', () => {
  assert.equal(
    removeTcNumber('tc no 12345678901 kime ait'),
    'tc no [TC number removed] kime ait'
  )
})
test('keeps a 10-digit number unchanged', () => {
  assert.equal(
    removeTcNumber('1234567890 kime ait'),
    '1234567890 kime ait'
  )
})
test('keeps a 12-digit number unchanged', () => {
  assert.equal(
    removeTcNumber('123456789012 kime ait'),
    '123456789012 kime ait'
  )
})
test('keeps an 11-digit number starting with 0 unchanged', () => {
  assert.equal(
    removeTcNumber('01234567890 kime ait'),
    '01234567890 kime ait'
  )
})
test('check a TC number at the beginning of a sentence', () => {
  assert.equal(
    removeTcNumber('02345678900 kime ait'),
    '02345678900 kime ait'
  )
})
test('removes multiple TC numbers', () => {
  assert.equal(
    removeTcNumber('12345678901 ve 98765432109 kime ait'),
    '[TC number removed] ve [TC number removed] kime ait'
  )
})
test('removes a TC number at the beginning of a sentence', () => {
  assert.equal(
    removeTcNumber('12345678901 kime ait'),
    '[TC number removed] kime ait'
  )
})




