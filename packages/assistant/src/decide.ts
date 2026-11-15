import { LANGS, type Lang } from '@burrowl/privacy'
import { B, E, detectLanguage, escapeRegExp, foldTurkish } from './text.ts'

interface SearchKeywords {
  prefixes: string[]
  words: string[]
}

const keywords: Record<Lang, SearchKeywords> = {
  tr: {
    prefixes: [
      'bugün', 'fiyat', 'güncel', 'haber', 'borsa', 'döviz', 'dolar', 'hava durumu',
      'öner', 'tavsiye', 'karşılaştır', 'en iyi', 'en ucuz', 'yeni çıkan', 'piyasa',
    ],
    words: ['son', 'kur'],
  },
  en: {
    prefixes: [
      'today', 'tonight', 'yesterday', 'latest', 'current', 'price', 'news', 'stock', 'weather',
      'recommend', 'best', 'cheapest', 'review', 'compare',
    ],
    words: ['now', 'vs'],
  },
  ru: {
    prefixes: [
      'сегодня', 'сейчас', 'вчера', 'завтра', 'цена', 'цены', 'цену', 'курс', 'новост', 'последн',
      'актуальн', 'погод', 'бирж', 'посовет', 'рекоменд', 'лучш', 'сравн', 'обзор',
    ],
    words: [],
  },
}

const prefixPattern = new RegExp(
  `${B}(${LANGS.flatMap((l) => keywords[l].prefixes).map((w) => escapeRegExp(foldTurkish(w))).join('|')})`,
  'iu',
)
const wordPatterns = Object.fromEntries(
  LANGS.map((l) => [
    l,
    keywords[l].words.length
      ? new RegExp(`${B}(${keywords[l].words.map((w) => escapeRegExp(foldTurkish(w))).join('|')})${E}`, 'iu')
      : null,
  ]),
) as Record<Lang, RegExp | null>

const yearPattern = new RegExp(String.raw`${B}(19|20)\d{2}${E}`, 'u')
const moneyPattern = new RegExp(
  String.raw`\d\s?(₺|\$|€|£|₽|TL${E}|USD${E}|EUR${E}|RUB${E}|руб)|(\$|€|£)\s?\d`,
  'iu',
)

const FACT_QUESTION = new RegExp(
  `${B}(${[
    'kim', 'kimdir', 'kimin', 'nerede', 'neresi', 'nereye', 'nedir', 'ne zaman', 'kac', 'kactir', 'hangi', 'hangisi',
    'who', 'whom', 'whose', 'where', 'when', 'which', 'what is', 'what are', 'what was', 'how many', 'how much',
    'how tall', 'how long', 'how far', 'how old',
    'кто', 'где', 'когда', 'сколько', 'какой', 'какая', 'какое', 'какие', 'что такое',
  ].join('|')})${E}` +
    `|${B}(${['nufus', 'baskent', 'yuzolcum', 'yuksekli', 'uzunlu', 'kurucu', 'yazari', 'yonetmen', 'population', 'capital', 'столиц', 'население', 'высот'].join('|')})`,
  'iu',
)

const NO_SEARCH = new RegExp(
  [
    String.raw`\d+\s*(x|\*|\+|-|/|carpi|bolu|arti|eksi|times|plus|minus|divided by|умнож\S*|плюс|минус|раздел\S*)\s*(на\s*|by\s*)?\d+`,
    String.raw`${B}(siir|hikaye|masal|sarki|mektup|poem|story|song|letter|стих\S*|рассказ\S*|сказк\S*|песн\S*|письм\S*)${E}`,
    String.raw`${B}(cevir|translate|перевед\S*|переведи)`,
    String.raw`${B}(hangi yil|hangi gun|hangi ay|saat kac|what (day|year|time) is|который час|какой сегодня (день|год))`,
  ].join('|'),
  'iu',
)

export function needsSearch(question: string, uiLang: Lang = 'tr'): boolean {
  if (yearPattern.test(question) || moneyPattern.test(question)) return true
  const folded = foldTurkish(question)
  if (prefixPattern.test(folded)) return true

  const langs = new Set([uiLang, detectLanguage(question, uiLang)])
  if ([...langs].some((l) => wordPatterns[l]?.test(folded) ?? false)) return true

  return FACT_QUESTION.test(folded) && !NO_SEARCH.test(folded)
}
