export type Lang = 'tr' | 'en' | 'ru'
export const LANGS: Lang[] = ['tr', 'en', 'ru']

const B = String.raw`(?<![\p{L}\p{N}])`
const E = String.raw`(?![\p{L}\p{N}])`

const emailPattern = /[^\s@]+@[^\s@]+\.[^\s@]+/
const emailPatternGlobal = /[^\s@]+@[^\s@]+\.[^\s@]+/g

export function hasEmail(text: string): boolean {
  return emailPattern.test(text)
}

export function removeEmails(text: string): string {
  return text.replace(emailPatternGlobal, '[email removed]')
}

const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29,
  CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20, EG: 29, ES: 24, FI: 18, FR: 27,
  GB: 22, GE: 22, GR: 27, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27,
  JO: 30, KW: 30, KZ: 20, LB: 28, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24,
  ME: 22, MK: 19, MT: 31, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29,
  RO: 24, RS: 22, SA: 24, SE: 24, SI: 19, SK: 24, SM: 27, TN: 24, TR: 26, UA: 29,
  XK: 20,
}

const ibanPattern = new RegExp(
  String.raw`${B}([A-Z]{2})\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?${E}`,
  'giu',
)

export function removeIbans(text: string): string {
  return text.replace(ibanPattern, (match: string, country: string) => {
    const length = match.replace(/\s/g, '').length
    return IBAN_LENGTHS[country.toUpperCase()] === length ? '[IBAN removed]' : match
  })
}

const cardPattern = new RegExp(String.raw`${B}\d(?:[ -]?\d){12,18}${E}`, 'gu')

function passesLuhn(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export function removeCardNumbers(text: string): string {
  return text.replace(cardPattern, (match) =>
    passesLuhn(match.replace(/\D/g, '')) ? '[card number removed]' : match,
  )
}

const intlPhonePattern = new RegExp(String.raw`${B}\+\d[\d\s().-]{6,18}\d${E}`, 'gu')

export function removeInternationalPhones(text: string): string {
  return text.replace(intlPhonePattern, (match) => {
    const digits = match.replace(/\D/g, '').length
    return digits >= 8 && digits <= 15 ? '[phone number removed]' : match
  })
}

const phonePattern = /((\+90|0)[\s-]?)?(5\d{2})[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/g

export function removePhones(text: string): string {
  return text.replace(phonePattern, '[phone number removed]')
}

const tcPattern = new RegExp(String.raw`${B}[1-9]\d{10}${E}`, 'gu')

export function removeTcNumber(text: string): string {
  return text.replace(tcPattern, '[TC number removed]')
}

const ruPhonePattern = new RegExp(
  String.raw`(?:\+7|${B}8)[\s-]?\(?9\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}${E}`,
  'gu',
)
const snilsPattern = new RegExp(String.raw`${B}\d{3}-\d{3}-\d{3}[\s-]\d{2}${E}`, 'gu')
const ruPassportPattern = new RegExp(String.raw`${B}\d{2}\s?\d{2}\s?\d{6}${E}`, 'gu')

const ssnPattern = new RegExp(String.raw`${B}\d{3}-\d{2}-\d{4}${E}`, 'gu')
const usPhonePattern = new RegExp(
  String.raw`(?:\+1[\s.-]?)?(?:\(\d{3}\)\s?|${B}\d{3}[\s.-])\d{3}[\s.-]\d{4}${E}`,
  'gu',
)

interface PrivacyRule {
  kind: string
  apply: (text: string) => string
}

function rule(kind: string, pattern: RegExp, placeholder: string): PrivacyRule {
  return { kind, apply: (text) => text.replace(pattern, placeholder) }
}

const universalFirst: PrivacyRule[] = [
  { kind: 'email', apply: removeEmails },
  { kind: 'iban', apply: removeIbans },
  { kind: 'card', apply: removeCardNumbers },
]

const localRules: Record<Lang, PrivacyRule[]> = {
  tr: [
    { kind: 'phone', apply: removePhones },
    { kind: 'tc', apply: removeTcNumber },
  ],
  ru: [
    rule('phone', ruPhonePattern, '[phone number removed]'),
    rule('snils', snilsPattern, '[SNILS removed]'),
    rule('passport', ruPassportPattern, '[passport number removed]'),
  ],
  en: [
    rule('ssn', ssnPattern, '[SSN removed]'),
    rule('phone', usPhonePattern, '[phone number removed]'),
  ],
}

const universalLast: PrivacyRule[] = [
  { kind: 'phone', apply: removeInternationalPhones },
]

export interface SanitizeResult {
  text: string
  removed: string[]
}

export function sanitizeQuery(text: string, lang: Lang | Lang[] = 'tr'): SanitizeResult {
  const langs = Array.isArray(lang) ? lang : [lang]
  const local = [...new Set(langs)].flatMap((l) => localRules[l])
  const removed: string[] = []
  let result = text

  for (const r of [...universalFirst, ...local, ...universalLast]) {
    const next = r.apply(result)
    if (next !== result && !removed.includes(r.kind)) {
      removed.push(r.kind)
    }
    result = next
  }

  return { text: result, removed }
}
