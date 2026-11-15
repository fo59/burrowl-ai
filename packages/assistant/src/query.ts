import { sanitizeQuery, LANGS, type Lang } from '@burrowl/privacy'
import { terms } from '@burrowl/knowledge'
import type { ChatMessage, LlmEngine } from '@burrowl/llm-engine'
import { B, E, foldTurkish, stripSuffixes } from './text.ts'
import { needsSearch } from './decide.ts'

export const QUESTION_WORDS = new Set([
  'ne', 'neler', 'nedir', 'nasıl', 'kaç', 'kim', 'kimdir', 'hangi', 'hangisi', 'mi', 'mı', 'mu', 'mü',
  'neresi', 'nerede', 'nereye', 'peki', 'onun', 'eder',
  'midir', 'mıdır', 'acaba', 'lütfen', 'bana', 'söyle', 'söyler', 'misin', 'anlat', 'merak', 'ediyorum', 'bir',
  've', 'ile', 'için', 'bu', 'şu', 'da', 'de',
  'what', 'whats', 'who', 'how', 'which', 'when', 'where', 'why', 'is', 'are', 'the', 'a', 'an', 'of', 'do',
  'does', 'please', 'tell', 'me', 'about', 'can', 'you', 'i', 'to', 'in', 'on', 'for',
  'что', 'кто', 'как', 'какой', 'какая', 'какие', 'сколько', 'где', 'когда', 'почему', 'ли', 'мне',
  'расскажи', 'скажи', 'пожалуйста', 'это', 'в', 'на', 'о', 'про', 'и',
])

export function keywordQuery(question: string): string {
  return stripSuffixes(question)
    .split(/[^\p{L}\p{N}$€£₺₽%.,-]+/u)
    .map((w) => w.replace(/^[.,-]+|[.,-]+$/g, ''))
    .filter((w) => w && !QUESTION_WORDS.has(w.toLocaleLowerCase()))
    .slice(0, 8)
    .join(' ')
}

export function toOutgoingQuery(query: string, langs: Lang[]): { query: string; removed: string[] } {
  const { text, removed } = sanitizeQuery(query, langs)
  const kept = text.replace(/\[[^\]]*removed\]/g, ' ').split(/\s+/).filter((w) => w && !w.includes('@'))
  return { query: kept.slice(0, 6).join(' '), removed }
}

const LANGUAGE_NAMES: Record<Lang, string> = { tr: 'Turkish', en: 'English', ru: 'Russian' }

function rewritePrompt(lang: Lang): string {
  return (
    'You turn a user question into a short web search query. Rules: 3 to 6 keywords, ' +
    `written in ${LANGUAGE_NAMES[lang]} (never translate), leave out names of private people ` +
    '(relatives, friends), phone numbers, e-mails and ID numbers, no punctuation or explanation. ' +
    'If the question refers back with a word like "it", "its", "there", "onun", "orası", "его" or "там", ' +
    'use the thing named in the earlier answer. Output only the query.'
  )
}

const EARLIER_LABEL: Record<Lang, string> = { tr: 'Önceki soru', en: 'Earlier question', ru: 'Предыдущий вопрос' }
const EARLIER_ANSWER_LABEL: Record<Lang, string> = { tr: 'Önceki cevap', en: 'Earlier answer', ru: 'Предыдущий ответ' }
const QUESTION_LABEL: Record<Lang, string> = { tr: 'Soru', en: 'Question', ru: 'Вопрос' }

export interface EarlierTurn {
  question: string
  answer?: string
}

export const stems = (text: string) => terms(foldTurkish(stripSuffixes(text)))

export async function rewriteQuery(
  question: string,
  lang: Lang,
  engine: LlmEngine,
  earlier: EarlierTurn | null,
  signal?: AbortSignal,
): Promise<string> {
  const safe = (text: string) => sanitizeQuery(text, LANGS).text.replace(/\[[^\]]*removed\]/g, ' ').replace(/\s+/g, ' ').trim()
  question = safe(question)
  if (earlier) earlier = { question: safe(earlier.question), ...(earlier.answer ? { answer: safe(earlier.answer) } : {}) }
  const content = earlier
    ? [
        `${EARLIER_LABEL[lang]}: ${earlier.question}`,
        ...(earlier.answer ? [`${EARLIER_ANSWER_LABEL[lang]}: ${earlier.answer}`] : []),
        `${QUESTION_LABEL[lang]}: ${question}`,
      ].join('\n')
    : question
  const out = await engine.generate(
    [
      { role: 'system', content: rewritePrompt(lang) },
      { role: 'user', content },
    ],
    { signal, temperature: 0, maxTokens: 24 },
  )

  const allowed = new Set(stems([question, earlier?.question ?? '', earlier?.answer ?? ''].join(' ')))
  const seen = new Set<string>()
  const kept = stripSuffixes(out.split('\n')[0])
    .replace(/["«»“”?!:;.,()]/g, ' ')
    .split(/\s+/)
    .filter((w) => {
      const [stem] = stems(w)
      if (!stem || !allowed.has(stem) || seen.has(stem)) return false
      seen.add(stem)
      return true
    })
  return kept.join(' ')
}

export function recentHistory(history: ChatMessage[], turns = 3): ChatMessage[] {
  return history
    .filter((m) => m.role !== 'system' && m.content.trim())
    .slice(-turns * 2)
    .map((m) => ({ role: m.role, content: m.content.length > 500 ? `${m.content.slice(0, 500)}…` : m.content }))
}

const FOLLOW_UP = new RegExp(
  `${B}(bu|bunu|bunlar|bunun|o|onu|onun|orasi|oranin|peki|daha|baska|yeni|yenisi|guncel|eski|diger|that|this|it|its|there|more|other|newer|another|это|его|её|ее|там|ещё|еще|другой|новее)${E}`,
  'iu',
)

export function searchFollowUpOf(question: string, history: ChatMessage[], uiLang: Lang): EarlierTurn | null {
  const at = history.map((m) => m.role).lastIndexOf('user')
  if (at < 0 || question.split(/\s+/).length > 10 || !FOLLOW_UP.test(foldTurkish(question))) return null
  const previous = history[at].content
  if (!needsSearch(`${previous} ${question}`, uiLang)) return null
  const reply = history[at + 1]?.content ?? ''
  const firstSentence = reply.split(/(?<=[.!?])\s/)[0]?.slice(0, 200)
  return { question: previous, ...(/\[\d+\]/.test(reply) && firstSentence ? { answer: firstSentence } : {}) }
}
