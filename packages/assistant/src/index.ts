import { sanitizeQuery, LANGS, type Lang } from '@burrowl/privacy'

export { LANGS, type Lang }

// JavaScript's \b only treats ASCII letters as word characters; these work for every script.
const B = String.raw`(?<![\p{L}\p{N}])`
const E = String.raw`(?![\p{L}\p{N}])`

interface SearchKeywords {
  // Matched at the start of a word, so suffixed forms count too (fiyat → fiyatları).
  prefixes: string[]
  // Matched as whole words only; short words that would otherwise hit unrelated
  // words (son → sonra) or collide across languages (Turkish "son" vs English "son").
  words: string[]
}

const keywords: Record<Lang, SearchKeywords> = {
  tr: {
    prefixes: ['bugün', 'fiyat', 'güncel', 'haber', 'borsa', 'döviz', 'dolar', 'hava durumu'],
    words: ['son', 'kur'],
  },
  en: {
    prefixes: ['today', 'tonight', 'yesterday', 'latest', 'current', 'price', 'news', 'stock', 'weather'],
    words: ['now'],
  },
  ru: {
    prefixes: ['сегодня', 'сейчас', 'вчера', 'завтра', 'цена', 'цены', 'цену', 'курс', 'новост', 'последн', 'актуальн', 'погод', 'бирж'],
    words: [],
  },
}

function escape(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const prefixPattern = new RegExp(
  `${B}(${LANGS.flatMap((l) => keywords[l].prefixes).map(escape).join('|')})`,
  'iu',
)
const wordPatterns = Object.fromEntries(
  LANGS.map((l) => [
    l,
    keywords[l].words.length
      ? new RegExp(`${B}(${keywords[l].words.map(escape).join('|')})${E}`, 'iu')
      : null,
  ]),
) as Record<Lang, RegExp | null>

const yearPattern = new RegExp(String.raw`${B}(19|20)\d{2}${E}`, 'u')
const moneyPattern = new RegExp(
  String.raw`\d\s?(₺|\$|€|£|₽|TL${E}|USD${E}|EUR${E}|RUB${E}|руб)|(\$|€|£)\s?\d`,
  'iu',
)

export function detectLanguage(text: string, fallback: Lang): Lang {
  if (/\p{Script=Cyrillic}/u.test(text)) return 'ru'
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return 'tr'
  return fallback
}

export function needsSearch(question: string, uiLang: Lang = 'tr'): boolean {
  if (yearPattern.test(question) || moneyPattern.test(question)) return true
  if (prefixPattern.test(question)) return true

  const langs = new Set([uiLang, detectLanguage(question, uiLang)])
  return [...langs].some((l) => wordPatterns[l]?.test(question) ?? false)
}

export interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
  searchQuery?: string
}

const placeholderReplies: Record<Lang, { search: string; local: string }> = {
  tr: {
    search: 'Bunun için internette arama yapmam gerekiyor. (yakında)',
    local: 'Bu soruyu cihazda cevaplayabilirim. (yakında)',
  },
  en: {
    search: 'I need to search the web for this. (coming soon)',
    local: 'I can answer this on the device. (coming soon)',
  },
  ru: {
    search: 'Для этого мне нужно поискать в интернете. (скоро)',
    local: 'Я могу ответить на это прямо на устройстве. (скоро)',
  },
}

export function reply(question: string, id: number, uiLang: Lang = 'tr'): Message {
  const search = needsSearch(question, uiLang)
  const langs = [uiLang, detectLanguage(question, uiLang)]
  return {
    id,
    role: 'assistant',
    text: search ? placeholderReplies[uiLang].search : placeholderReplies[uiLang].local,
    searchQuery: search ? sanitizeQuery(question, langs).text : undefined,
  }
}
