import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  removeTcNumber,
  removePhones,
  hasEmail,
  removeEmails,
  removeIbans,
  removeCardNumbers,
  removeInternationalPhones,
  sanitizeQuery,
} from './index.js'
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

describe('removeIbans', ()  => {
  test('removes a compact IBAN', () => {
    assert.equal(
    removeIbans('iban TR120006100519786457841326 kime ait'),
      'iban [IBAN removed] kime ait'
    )
  })
  test('removes a spaced IBAN', () => {
    assert.equal(
      removeIbans('TR12 0006 1005 1978 6457 8413 26 hesabina'),
      '[IBAN removed] hesabina'
    )
  })
  test('removes a lowercase IBAN', () => {
    assert.equal(
      removeIbans('tr120006100519786457841326'),
      '[IBAN removed]'
    )
  })
    test('keeps a too short IBAN unchanged', () => {
    assert.equal(
      removeIbans('TR1200061005'),
      'TR1200061005'
    )
  })
  test('keeps a too long number unchanged', () => {
  assert.equal(
    removeIbans('TR1200061005197864578413261'),
    'TR1200061005197864578413261'
    )
  })
})

describe('sanitizeQuery',() =>{
  test('returns the text unchanged when there is nothing personal', () => {
    assert.deepEqual(
      sanitizeQuery('en iyi telefon 5000 TL 2026'),
      { text: 'en iyi telefon 5000 TL 2026', removed: [] }
    )
  })
  test('removes an email and a phone together', () => {
    assert.deepEqual(
      sanitizeQuery('ali@gmail.com ve 0532 123 45 67 kimin'),
      { text: '[email removed] ve [phone number removed] kimin', removed: ['email', 'phone'] }
    )
    })
  test('removes a spaced IBAN without touching it as a phone', () =>{
    assert.deepEqual(
      sanitizeQuery('TR12 0006 1005 1978 6457 8413 26'),
      { text: '[IBAN removed]', removed: ['iban'] }
    )
  })
  test('removes a compact IBAN before the phone filter can break it', () => {
    assert.deepEqual(
      sanitizeQuery('TR120006100519786457841326'),
      { text: '[IBAN removed]', removed: ['iban'] }
    )
  })
})

describe('removeIbans (other countries)', () => {
  test('removes a German IBAN', () => {
    assert.equal(removeIbans('DE89 3704 0044 0532 0130 00 kime ait'), '[IBAN removed] kime ait')
  })
  test('removes a British IBAN with letters in it', () => {
    assert.equal(removeIbans('GB29NWBK60161331926819'), '[IBAN removed]')
  })
  test('keeps an IBAN-like string with the wrong length for its country', () => {
    assert.equal(removeIbans('DE89 3704 0044 0532 0130'), 'DE89 3704 0044 0532 0130')
  })
})

describe('removeCardNumbers', () => {
  test('removes a valid card number', () => {
    assert.equal(removeCardNumbers('kart 4111 1111 1111 1111'), 'kart [card number removed]')
  })
  test('keeps a number that fails the Luhn check', () => {
    assert.equal(removeCardNumbers('4111 1111 1111 1112'), '4111 1111 1111 1112')
  })
})

describe('removeInternationalPhones', () => {
  test('removes a number with a country code', () => {
    assert.equal(removeInternationalPhones('call +44 20 7946 0958 now'), 'call [phone number removed] now')
  })
  test('keeps a short number after a plus sign', () => {
    assert.equal(removeInternationalPhones('+5 degrees'), '+5 degrees')
  })
})

describe('sanitizeQuery (Russian)', () => {
  test('removes a Russian mobile number', () => {
    assert.deepEqual(sanitizeQuery('чей номер +7 912 345-67-89', 'ru'), {
      text: 'чей номер [phone number removed]',
      removed: ['phone'],
    })
  })
  test('removes a Russian number written with 8 and brackets', () => {
    assert.equal(sanitizeQuery('8 (912) 345-67-89 кто это', 'ru').text, '[phone number removed] кто это')
  })
  test('removes a SNILS number', () => {
    assert.equal(sanitizeQuery('СНИЛС 112-233-445 95', 'ru').text, 'СНИЛС [SNILS removed]')
  })
  test('removes a passport number', () => {
    assert.equal(sanitizeQuery('паспорт 45 01 123456', 'ru').text, 'паспорт [passport number removed]')
  })
  test('removes an email with a Cyrillic name', () => {
    assert.equal(sanitizeQuery('иван@mail.ru кто это', 'ru').text, '[email removed] кто это')
  })
  test('keeps a year in a Russian sentence', () => {
    assert.deepEqual(sanitizeQuery('лучший телефон 2026 года', 'ru'), {
      text: 'лучший телефон 2026 года',
      removed: [],
    })
  })
})

describe('sanitizeQuery (English)', () => {
  test('removes a social security number', () => {
    assert.equal(sanitizeQuery('my SSN is 123-45-6789', 'en').text, 'my SSN is [SSN removed]')
  })
  test('removes a US phone number with brackets', () => {
    assert.equal(sanitizeQuery('who owns (555) 123-4567', 'en').text, 'who owns [phone number removed]')
  })
  test('removes a Turkish number in English mode through the international rule', () => {
    assert.equal(sanitizeQuery('who is +90 532 123 45 67', 'en').text, 'who is [phone number removed]')
  })
  test('keeps prices and short numbers', () => {
    assert.deepEqual(sanitizeQuery('best phone under 1200 dollars, call 911', 'en'), {
      text: 'best phone under 1200 dollars, call 911',
      removed: [],
    })
  })
})
