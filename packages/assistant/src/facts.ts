import { B, foldTurkish, stripSuffixes } from './text.ts'

// Structured facts (capital, population, author...) come from Wikidata, where
// they are stored as data instead of prose. Full-text encyclopedia search
// cannot answer "capital of Turkey" (it returned a person named Türki).

export type FactKind = 'capital' | 'population' | 'height' | 'author' | 'founder' | 'director' | 'currency' | 'language'

export interface FactRequest {
  kind: FactKind
  properties: string[]
  // names to look up, best guess first ("Türkiye", then "Türkiyenin")
  subjects: string[]
}

// Patterns run on folded text (Turkish letters → ASCII, lowercase).
const KINDS: { kind: FactKind; properties: string[]; pattern: RegExp }[] = [
  { kind: 'capital', properties: ['P36'], pattern: /baskent\p{L}*|capital|столиц\p{L}*/u },
  { kind: 'population', properties: ['P1082'], pattern: /nufus\p{L}*|population|how many people live|населени\p{L}*|сколько (человек|людей) живут?/u },
  { kind: 'height', properties: ['P2044', 'P2048'], pattern: /yuksekli\p{L}*|kac metre|how (tall|high)|height|elevation|высот\p{L}*/u },
  { kind: 'author', properties: ['P50'], pattern: /yazar\p{L}*|kim yazdi|kimin eseri|who wrote|author|автор\p{L}*|кто написал/u },
  { kind: 'founder', properties: ['P112'], pattern: /kurucu\p{L}*|kim kurdu|who founded|founder|основател\p{L}*|кто основал/u },
  { kind: 'director', properties: ['P57'], pattern: /yonetmen\p{L}*|who directed|director|режисс[её]р\p{L}*/u },
  { kind: 'currency', properties: ['P38'], pattern: /para birim\p{L}*|currency|валют\p{L}*/u },
  { kind: 'language', properties: ['P37'], pattern: /resmi dil\p{L}*|official language|официальн\p{L}* язык\p{L}*/u },
]

// Words that are not part of the name. "ve/and/и" stay: "Savaş ve Barış".
const FILLER = new Set([
  'benim', 'ne', 'nedir', 'neresi', 'nerede', 'kim', 'kimdir', 'kac', 'kactir', 'hangi', 'hangisi', 'mi', 'mu', 'midir',
  'kadar', 'acaba', 'peki', 'bana', 'soyle', 'soyler', 'misin', 'lutfen', 'su', 'an', 'guncel', 'simdi', 'olan', 'en',
  'my', 'what', 'whats', 'who', 'which', 'is', 'are', 'was', 'the', 'a', 'an', 'of', 'tell', 'me', 'please', 'current', 'now',
  'мой', 'моя', 'что', 'кто', 'какая', 'какой', 'какое', 'какие', 'сколько', 'у', 'в', 'скажи', 'пожалуйста', 'сейчас', 'является',
])

// "Everest dağının yüksekliği": the kind of thing is not part of its name.
const TYPE_WORD = /^(kitab|roman|film|dag|sirket|ulke|sehir|kent|book|novel|movie|mountain|company|country|city|книг|роман|фильм|гор|компани|стран|город)\p{L}*$/u

// Genitive endings: "Türkiyenin" → "Türkiye", "Казахстана" → "Казахстан".
// A name can end like a suffix (Berlin, Tesla), so the word as typed is kept
// as a candidate too; the caller prefers an exact label match.
const TR_ENDINGS = ['nin', 'nın', 'nun', 'nün', 'in', 'ın', 'un', 'ün']
const RU_ENDINGS: [string, string][] = [['ы', 'а'], ['и', 'а'], ['и', 'я'], ['а', ''], ['я', 'ь'], ['у', '']]

function nameForms(word: string): string[] {
  const lower = word.toLocaleLowerCase('tr')
  const forms: string[] = []
  if (/\p{Script=Cyrillic}/u.test(word)) {
    for (const [ending, replacement] of RU_ENDINGS) {
      if (lower.endsWith(ending) && word.length > 4) forms.push(word.slice(0, -1) + replacement)
    }
  } else {
    for (const ending of TR_ENDINGS) {
      if (lower.endsWith(ending) && word.length - ending.length >= 3) forms.push(word.slice(0, -ending.length))
    }
  }
  return [...forms, word]
}

// "its population" after "capital of France → Paris": the pronoun is the answer.
const PRONOUN = /^(onun|onu|bunun|şunun|orasının|oranın|its|it|his|her|their|его|её|ее|их)$/u

// Reads the subject out of an earlier Wikidata answer ("Fransa — başkent: Paris [1].").
function valueOf(earlierAnswer: string | undefined): string | null {
  const m = earlierAnswer && /—[^:]+:\s*([^,(\[]+)/u.exec(earlierAnswer)
  return m ? m[1].trim() : null
}

export function factRequest(question: string, earlierAnswer?: string): FactRequest | null {
  const kindOf = (t: string) => KINDS.find((k) => new RegExp(`${B}(${k.pattern.source})`, 'u').test(foldTurkish(t)))
  // "...yazıyorum, Kazakistanın başkenti neresi": only the clause that asks
  const clause = stripSuffixes(question).split(/[,.;!?]/).find((c) => kindOf(c))
  if (!clause) return null
  const match = kindOf(clause)!
  const text = clause.replace(/[:"«»()]/g, ' ')
  const folded = foldTurkish(text)

  // Remove the property words and the filler; what is left is the name.
  // foldTurkish keeps positions, so the cut is made on the original spelling.
  const found = new RegExp(`${B}(${match.pattern.source})`, 'u').exec(folded)!
  const rest = (text.slice(0, found.index) + ' ' + text.slice(found.index + found[0].length))
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(foldTurkish(w)) && !/^\d+$/.test(w))
  const pronoun = rest.findIndex((w) => PRONOUN.test(w.toLocaleLowerCase('tr')))
  if (pronoun >= 0) {
    const earlier = valueOf(earlierAnswer)
    // without a clear earlier answer the general search (which sees the conversation) handles it
    if (!earlier) return null
    return { kind: match.kind, properties: match.properties, subjects: [earlier] }
  }
  while (rest.length && TYPE_WORD.test(foldTurkish(rest[rest.length - 1]))) rest.pop()
  // English: "the capital of France" leaves "France"; nothing left means no subject
  if (rest.length === 0 || rest.length > 5) return null

  const last = rest[rest.length - 1]
  const head = rest.slice(0, -1).join(' ')
  const subjects = [...new Set(nameForms(last).map((f) => `${head} ${f}`.trim()))]
  return { kind: match.kind, properties: match.properties, subjects }
}
