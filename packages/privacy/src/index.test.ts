import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { removeTcNumber, removePhones, hasEmail, removeEmails } from './index.js'
describe('removeTcNumber', () => {

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
})

describe('removePhones', () => {
  test('removes a number with spaces', () => {
    assert.equal(
      removePhones('beni 0532 123 45 67 numarasindan ara'),
      'beni [phone number removed] numarasindan ara'
    )
  })
  test('removes a number without spaces', () => {
    assert.equal(
      removePhones('numaram 05321234567'),
      'numaram [phone number removed]'
    )
  })
  test('removes a number with +90 prefix', () => {
    assert.equal(
      removePhones('+90 532 123 45 67 kimin numarasi'),
      '[phone number removed] kimin numarasi'
    )
  })
  test('removes a number with dashes', () => {
    assert.equal(
      removePhones('0532-123-45-67 kayitli mi'),
      '[phone number removed] kayitli mi'
    )
  })
  test('keeps the space before a number without prefix', () => {
    assert.equal(
      removePhones('ara 532 123 45 67'),
      'ara [phone number removed]'
    )
  })
  test('keeps a year unchanged', () => {
    assert.equal(
      removePhones('2026 yili fiyatlari'),
      '2026 yili fiyatlari'
    )
  })
  test('keeps a price unchanged', () => {
    assert.equal(
      removePhones('iphone 15 fiyati 50000 TL'),
      'iphone 15 fiyati 50000 TL'
    )
  })




})

describe('hasEmail', () => {
  test('finds an email inside a sentence', () => {
    assert.equal(
      hasEmail('iletisim: ali.veli@gmail.com'),
      true
    )
  })
  test('ignores a social media username', () => {
    assert.equal(
      hasEmail('@furkan instagramda'),
      false
    )
  })
  test('ignores a lone @ sign', () => {
    assert.equal(
      hasEmail('fiyat @ 500 TL'),
      false)
  })
  test('ignores an email without a domain extension', () => {
    assert.equal(
      hasEmail('mail: furkan@gmail'),
      false
    )
  })
  test('finds an uppercase email', () => {
    assert.equal(hasEmail('FURKAN@MAIL.COM'),
      true)
  })
  test('returns the same result when called twice', () => {
    assert.equal(hasEmail('furkan@example.com'),
      true)
    assert.equal(hasEmail('furkan@example.com'),
      true)
  })

})

describe('removeEmails', () => {
  test('removes an email inside a sentence', () => {
    assert.equal(
      removeEmails('ali.veli@gmail.com adresine kayitli hesap'),
      '[email removed] adresine kayitli hesap'
    )
  })
  test('removes multiple emails', () => {
    assert.equal(
      removeEmails('a@x.com ve b@y.com ikisine de yaz'),
      '[email removed] ve [email removed] ikisine de yaz'
    )
  })
  test('keeps text without an email unchanged', () => {
    assert.equal(
      removeEmails('bunda e-posta yok'),
      'bunda e-posta yok'
    )
  })
})


