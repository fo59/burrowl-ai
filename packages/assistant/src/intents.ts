import type { Lang } from '@burrowl/privacy'
import type { ChatMessage } from '@burrowl/llm-engine'
import { rateRequest, type RateRequest } from '@burrowl/web-search'
import { B, E, detectLanguage, foldTurkish, stripSuffixes, words } from './text.ts'
import { needsSearch } from './decide.ts'
import { evaluateMath, type Calculation } from './math.ts'

export type Intent =
  | { kind: 'meta' }
  | { kind: 'translate'; text: string | null; target: string }
  | { kind: 'math'; calculation: Calculation }
  | { kind: 'datetime' }
  | { kind: 'currency'; request: RateRequest }
  | { kind: 'weather'; places: string[] }
  | { kind: 'write' }
  | { kind: 'advice' }
  | { kind: 'recommend' }
  | { kind: 'correction'; previous: string }
  | { kind: 'fact' }
  | { kind: 'chat' }

const rx = (parts: string[], flags = 'iu') => new RegExp(`${B}(${parts.join('|')})${E}`, flags)

const META = rx([
  'internet\\S* (yararlandin|yararlandi|kullandin|kullandi|ciktin|cikti|baktin|bakti|gonderdin)',
  '(yararlandin|kullandin|ciktin|baktin) mi',
  'ne gonderildi', 'neler gonderildi', 'internete ne gitti',
  'did you (use|search|go to|look up)( the)? (internet|web)', 'did you search', 'what (was|did you) sen[dt]',
  'ты (использовал|искал|ходил)', 'ты искал в интернете', 'что (ты )?отправ\\S*',
])

const TRANSLATE = rx(['cevir\\S*', 'tercume\\S*', 'translat\\S*', 'перевед\\S*', 'перевод\\S*'])

const TARGETS: [RegExp, string, Lang | null][] = [
  [rx(['rusca\\S*', 'russian', 'на русский', 'по-русски', 'русск\\S*']), 'Russian', 'ru'],
  [rx(['ingilizce\\S*', 'english', 'на английский', 'английск\\S*']), 'English', 'en'],
  [rx(['turkce\\S*', 'turkish', 'на турецкий', 'турецк\\S*']), 'Turkish', 'tr'],
  [rx(['almanca\\S*', 'german', 'на немецкий', 'немецк\\S*']), 'German', null],
  [rx(['fransizca\\S*', 'french', 'на французский', 'французск\\S*']), 'French', null],
  [rx(['ispanyolca\\S*', 'spanish', 'на испанский', 'испанск\\S*']), 'Spanish', null],
  [rx(['arapca\\S*', 'arabic', 'на арабский', 'арабск\\S*']), 'Arabic', null],
]

const TRANSLATE_FILLER = rx([
  'bu', 'su', 'cumleyi', 'cumle', 'metni', 'metin', 'yaziyi', 'sunu', 'bunu', 'lutfen', 'bana', 'misin', 'mi', 'eder',
  'please', 'this', 'the', 'sentence', 'text', 'into', 'to', 'can', 'you',
  'пожалуйста', 'это', 'текст', 'предложение', 'на',
])

const CAN_YOU = rx([
  '\\S*(ebilir|abilir) mi\\S*', 'misin', 'misn', 'versem', 'verirsem', 'yazsam', 'yazarsam', 'gondersem',
  'can you', 'could you', 'would you', 'if i (give|send|write)',
  'можешь', 'сможешь', 'можно ли', 'если я (дам|пришлю|напишу)',
])

const DEFAULT_TARGET: Record<Lang, string> = { tr: 'English', en: 'Turkish', ru: 'English' }

function translateIntent(message: string, uiLang: Lang): { text: string | null; target: string } | null {
  const folded = foldTurkish(message)
  const verb = TRANSLATE.exec(folded)
  if (!verb) return null
  const target = TARGETS.find(([re]) => re.test(folded))?.[1] ?? DEFAULT_TARGET[uiLang]

  const quoted = message.match(/["“«']([^"”»']{2,})["”»']/)
  const onlyAsking = CAN_YOU.test(folded)
  if (quoted) return { text: quoted[1].trim(), target }
  const colon = message.indexOf(':')
  if (colon >= 0 && message.slice(colon + 1).trim()) return { text: message.slice(colon + 1).trim(), target }
  if (onlyAsking) return { text: null, target }

  const after = message.slice(verb.index + verb[0].length)
  const before = message.slice(0, verb.index)
  const clean = (part: string) => {
    let f = foldTurkish(part)
    for (const [re] of TARGETS) f = f.replace(new RegExp(re.source, 'giu'), ' ')
    f = f.replace(new RegExp(TRANSLATE_FILLER.source, 'giu'), ' ')
    const keep = new Set(f.split(/[^\p{L}\p{N}]+/u).filter(Boolean))
    return words(part).filter((w) => keep.has(foldTurkish(w))).join(' ')
  }
  const text = clean(after).split(' ').length >= clean(before).split(' ').length ? clean(after) : clean(before)
  return { text: text.split(' ').filter(Boolean).length >= 2 ? (after.trim() && clean(after) === text ? after.trim().replace(/^[,.:;]\s*/, '') : text) : null, target }
}

const DATETIME = rx([
  'hangi yil\\S*', 'hangi gun\\S*', 'hangi ay\\S*', 'saat kac', 'bugun ayin kaci', 'bugun gunlerden ne', 'tarih ne',
  'what (day|year|time|date) is (it|today)', "what's the (date|time)", 'todays date',
  'который час', 'какой сегодня (день|год)', 'какое сегодня число',
])

const WEATHER = rx([
  'hava durumu', 'hava nasil', 'hava kac', 'kac derece', 'hava sicak\\S*', 'hava soguk\\S*', 'sicaklik\\S*', 'yagmur yag\\S*', 'kar yag\\S*',
  'weather', 'temperature', 'how (hot|cold|warm)', 'is it raining',
  'погод\\S*', 'температур\\S*', 'сколько градусов', 'идёт ли дождь', 'идет ли дождь',
])

const WEATHER_WORDS = new Set([
  'hava', 'durumu', 'nasil', 'kac', 'derece', 'sicak', 'soguk', 'sicaklik', 'bugun', 'simdi', 'suan', 'su', 'an', 'anlik',
  'yarin', 'orada', 'orasi', 'peki', 'acaba', 'yagmur', 'kar', 'yagiyor', 'mi', 'mu', 'ne', 'de', 'da', 'icin', 've',
  'rus', 'turk', 'sehri', 'sehir', 'sehrinde', 'ulke',
  'weather', 'in', 'the', 'what', 'is', 'how', 'today', 'now', 'temperature', 'hot', 'cold', 'warm', 'it', 'raining', 'like',
  'погода', 'погоду', 'погоды', 'в', 'во', 'сейчас', 'сегодня', 'какая', 'какой', 'сколько', 'градусов', 'температура', 'там', 'а',
])

function placeForms(word: string): string[] {
  const forms = new Set<string>()
  const w = stripSuffixes(word)
  if (/\p{Script=Cyrillic}/u.test(w)) {
    if (/е$/u.test(w)) forms.add(w.replace(/е$/u, 'а'))
    if (/и$/u.test(w)) forms.add(w.replace(/и$/u, 'ь'))
    if (/[еуи]$/u.test(w)) forms.add(w.replace(/[еуи]$/u, ''))
  } else {
    const plain = w.match(/^(.{3,})(d[ae]|t[ae]|d[ae]n|t[ae]n)$/iu)
    if (plain) forms.add(plain[1])
    const buffered = w.match(/^(.{3,})(nd[ae]|nt[ae]|nd[ae]n)$/iu)
    if (buffered) forms.add(buffered[1])
  }
  forms.add(w)
  return [...forms].map((f) => f.charAt(0).toLocaleUpperCase() + f.slice(1))
}

export function placeCandidates(message: string): string[] {
  const found: string[] = []
  for (const w of words(message)) {
    const f = foldTurkish(stripSuffixes(w))
    if (w.length < 3 || /\d/.test(w) || WEATHER_WORDS.has(f) || WEATHER_WORDS.has(foldTurkish(w))) continue
    found.push(...placeForms(w))
  }
  return [...new Set(found)].slice(0, 4)
}

const CREATIVE = rx(['siir\\S*', 'hikaye\\S*', 'masal\\S*', 'sarki\\S*', 'mektup\\S*', 'kompozisyon\\S*', 'poem\\S*', 'story', 'stories', 'song\\S*', 'letter', 'essay', 'стих\\S*', 'рассказ\\S*', 'сказк\\S*', 'песн\\S*', 'письм\\S*', 'сочинени\\S*'])
const CREATIVE_VERB = rx(['yaz\\S*', 'uret\\S*', 'olustur\\S*', 'write', 'compose', 'make', 'напиш\\S*', 'сочин\\S*', 'придума\\S*'])

const PRODUCT = rx([
  'telefon\\S*', 'bilgisayar\\S*', 'laptop\\S*', 'tablet\\S*', 'kulaklik\\S*', 'televizyon\\S*', 'tv', 'araba\\S*', 'otomobil\\S*',
  'saat\\S*', 'kamera\\S*', 'konsol\\S*', 'buzdolab\\S*', 'camasir makine\\S*', 'monitor\\S*',
  'phone\\S*', 'smartphone\\S*', 'computer\\S*', 'laptops?', 'headphones?', 'earbuds', 'cars?', 'watch\\S*', 'cameras?', 'consoles?', 'monitors?',
  'телефон\\S*', 'смартфон\\S*', 'ноутбук\\S*', 'компьютер\\S*', 'наушник\\S*', 'машин\\S*', 'часы', 'камер\\S*', 'приставк\\S*',
])
const RECOMMEND = rx(['oner\\S*', 'tavsiye\\S*', 'en iyi', 'alabilirim', 'almaliyim', 'alayim', 'hangisini al\\S*', 'recommend\\S*', 'suggest\\S*', 'best', 'should i buy', 'посовет\\S*', 'рекоменд\\S*', 'лучш\\S*', 'купить'])

const ADVICE = rx([
  'nasil (cozerim|cozebilirim|davranmali\\S*|basa cikarim|basa cikabilirim|ikna ederim|konusmali\\S*)',
  'ne yapmali\\S*', 'ne yapayim', 'ne yapabilirim', 'taktik ver\\S*', 'tavsiye ver\\S*', 'tavsiyen ne', 'ayrildim', 'terk etti',
  'what should i do', 'how (do|can|should) i (deal|handle|cope|fix|solve|talk)', 'any advice', 'give me (some )?advice',
  'что (мне )?делать', 'как (мне )?(быть|справиться|поступить|поговорить)', 'дай совет',
])

const CORRECTION = new RegExp(`^\\s*(yanlis|hatali|dogru degil|olmadi|bu yanlis|wrong|incorrect|that'?s (wrong|not right)|неправильно|неверно|ошибка)`, 'iu')

function lastUserMessage(history: ChatMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) if (history[i].role === 'user') return history[i].content
  return null
}

export function detectIntent(message: string, history: ChatMessage[], uiLang: Lang): Intent {
  const folded = foldTurkish(message)

  if (META.test(folded)) return { kind: 'meta' }

  const previous = lastUserMessage(history)
  const asked = previous ? translateIntent(previous, uiLang) : null
  if (asked && asked.text === null && !TRANSLATE.test(folded)) return { kind: 'translate', text: message, target: asked.target }

  const translate = translateIntent(message, uiLang)
  if (translate) return { kind: 'translate', ...translate }

  const calculation = evaluateMath(message)
  if (calculation) return { kind: 'math', calculation }

  if (DATETIME.test(folded)) return { kind: 'datetime' }

  const request = rateRequest(message, detectLanguage(message, uiLang))
  if (request) return { kind: 'currency', request }

  if (WEATHER.test(folded)) return { kind: 'weather', places: placeCandidates(message) }

  if (CREATIVE.test(folded) && CREATIVE_VERB.test(folded)) return { kind: 'write' }

  if (RECOMMEND.test(folded) && PRODUCT.test(folded)) return { kind: 'recommend' }

  if (ADVICE.test(folded)) return { kind: 'advice' }

  if (previous && CORRECTION.test(folded) && message.split(/\s+/).length <= 12) {
    const lastQuestion = [...history].reverse().find((m) => m.role === 'user' && !CORRECTION.test(foldTurkish(m.content)))
    if (lastQuestion) return { kind: 'correction', previous: lastQuestion.content }
  }

  return needsSearch(message, uiLang) ? { kind: 'fact' } : { kind: 'chat' }
}
