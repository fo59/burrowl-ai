import { sanitizeQuery, LANGS, type Lang } from '@burrowl/privacy'
import {
  currentWeather,
  exchangeRates,
  fetchRate,
  geocode,
  readPages,
  searchAll,
  wikipedia,
  wikidataFact,
  wikidataSearch,
  plainName,
  type HttpOptions,
  type WikidataEntity,
  type Page,
  type SearchProvider,
} from '@burrowl/web-search'
import { chunkText, rankChunks, type Chunk } from '@burrowl/knowledge'
import { ollamaEngine, type ChatMessage, type LlmEngine } from '@burrowl/llm-engine'
import { LOCALES, detectLanguage } from './text.ts'
import { needsSearch } from './decide.ts'
import {
  keywordQuery,
  recentHistory,
  rewriteQuery,
  searchFollowUpOf,
  toOutgoingQuery,
  type EarlierTurn,
} from './query.ts'
import { advicePrompt, buildPrompt, translatePrompt, writePrompt, type Source } from './prompts.ts'
import { detectIntent, type Intent } from './intents.ts'
import { factRequest } from './facts.ts'
import { TEMPLATES, formatNumber } from './templates.ts'
import { dropInvalidCitations, evidenceCoverage, keepVerifiedSentences } from './verify.ts'

export { LANGS, type Lang, ollamaEngine, wikipedia, exchangeRates, type LlmEngine, type SearchProvider, type Page }
export { foldTurkish, stripSuffixes, detectLanguage } from './text.ts'
export { needsSearch } from './decide.ts'
export { keywordQuery, toOutgoingQuery, recentHistory, type EarlierTurn } from './query.ts'
export { buildPrompt, type Source } from './prompts.ts'
export { detectIntent, placeCandidates, type Intent } from './intents.ts'
export { evaluateMath } from './math.ts'
export { factRequest } from './facts.ts'
export { dropInvalidCitations, evidenceCoverage, keepVerifiedSentences } from './verify.ts'
// The UI only talks to the orchestrator, so conversation storage is reached through it too.
export {
  createKeyValueChatStore,
  createSqlChatStore,
  titleFrom,
  type ChatStore,
  type Conversation,
  type SqlDatabase,
  type StoredMessage,
} from '@burrowl/storage'

export type Status = 'thinking' | 'searching' | 'reading' | 'writing' | 'done' | 'error'

export interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
  searchQuery?: string
  sources?: Source[]
  status?: Status
  // privacy rule kinds that were removed from the outgoing query (email, phone...)
  removed?: string[]
  read?: { done: number; total: number }
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

// --- Answer flow -----------------------------------------------------------

export type AnswerEvent =
  | { type: 'search'; query: string; removed: string[] }
  | { type: 'sources'; sources: Source[] }
  | { type: 'read'; done: number; total: number }
  | { type: 'writing' }
  | { type: 'token'; text: string }

// What the previous answer did, for "did you use the internet?" questions.
export interface LastTurn {
  searchQuery?: string
  sources: number
  removed: string[]
}

export interface AnswerOptions {
  engine: LlmEngine
  // earlier messages of the conversation, oldest first
  history?: ChatMessage[]
  // pages read earlier in this conversation (reused by follow-up questions)
  pageCache?: Map<string, Page>
  providers?: SearchProvider[]
  web?: 'auto' | 'on' | 'off'
  signal?: AbortSignal
  onEvent?: (event: AnswerEvent) => void
  // the last assistant turn, null when there was none
  lastTurn?: LastTurn | null
  http?: Omit<HttpOptions, 'signal'>
  now?: Date
}

export interface AnswerResult {
  text: string
  intent: Intent['kind']
  searchQuery?: string
  removed?: string[]
  sources: Source[]
}

interface Context {
  question: string
  uiLang: Lang
  lang: Lang
  langs: Lang[]
  history: ChatMessage[]
  options: AnswerOptions
  t: (typeof TEMPLATES)[Lang]
}

export async function answer(question: string, uiLang: Lang, options: AnswerOptions): Promise<AnswerResult> {
  const history = recentHistory(options.history ?? [])
  const lang = detectLanguage(question, uiLang)
  const ctx: Context = {
    question,
    uiLang,
    lang,
    langs: [...new Set([uiLang, lang])],
    history,
    options,
    t: TEMPLATES[lang],
  }
  const web = options.web ?? 'auto'
  let intent = detectIntent(question, history, uiLang)
  // "isn't that old?" after a searched question needs fresh information too
  if (intent.kind === 'chat' && searchFollowUpOf(question, history, uiLang)) intent = { kind: 'fact' }
  // the web switch forces or forbids searching for questions the model would otherwise answer alone
  if (web === 'on' && intent.kind === 'chat') intent = { kind: 'fact' }
  if (web === 'off' && (intent.kind === 'fact' || intent.kind === 'recommend')) intent = { kind: 'chat' }

  const done = (text: string, extra: Partial<AnswerResult> = {}): AnswerResult => ({ text, intent: intent.kind, sources: [], ...extra })

  switch (intent.kind) {
    case 'meta':
      return done(metaAnswer(ctx))
    case 'math':
      return done(ctx.t.math(intent.calculation.expression, formatNumber(intent.calculation.value, lang, 6)))
    case 'datetime':
      return done(dateTimeAnswer(ctx))
    case 'translate':
      if (!intent.text) return done(ctx.t.askTextToTranslate)
      return done(await stream(ctx, translatePrompt(intent.text, intent.target), 0))
    case 'write':
      return done(await stream(ctx, writePrompt(question, lang), 0.8))
    case 'advice':
      return done(await stream(ctx, advicePrompt(question, lang), 0.5))
    case 'currency':
      if (web === 'off') return done(ctx.t.webOff)
      return { ...(await currencyAnswer(ctx, intent.request)), intent: intent.kind }
    case 'weather':
      if (web === 'off') return done(ctx.t.webOff)
      return { ...(await weatherAnswer(ctx, intent.places)), intent: intent.kind }
    case 'correction': {
      // "wrong" → answer the last question again with its own tool (weather,
      // rates...) or a fresh web search, instead of repeating the old answer
      const again = detectIntent(intent.previous, [], uiLang)
      const result =
        again.kind === 'chat' || again.kind === 'fact' || again.kind === 'correction'
          ? { ...(await researchAnswer({ ...ctx, question: intent.previous }, { strict: false })), intent: again.kind }
          : await answer(intent.previous, uiLang, { ...options, history: [] })
      return { ...result, text: `${ctx.t.checkedAgain} ${result.text}`, intent: intent.kind }
    }
    case 'recommend':
      return { ...(await researchAnswer(ctx, { strict: true })), intent: intent.kind }
    case 'fact': {
      // structured data first (capital, population...); prose search otherwise
      const fact = await factAnswer(ctx).catch(() => null)
      if (fact) return { ...fact, intent: intent.kind }
      return { ...(await researchAnswer(ctx, { strict: false })), intent: intent.kind }
    }
    case 'chat':
      return done(await stream(ctx, buildPrompt(question, lang, [], null, history, options.now), 0.2))
  }
}

async function stream(ctx: Context, messages: ChatMessage[], temperature: number): Promise<string> {
  ctx.options.onEvent?.({ type: 'writing' })
  const text = await ctx.options.engine.generate(messages, {
    signal: ctx.options.signal,
    temperature,
    onToken: (t) => ctx.options.onEvent?.({ type: 'token', text: t }),
  })
  return cleanOutput(dropInvalidCitations(text, 0))
}

// Small models sometimes slip into another script mid-sentence (Chinese words
// in a Turkish answer). None of our languages use those scripts.
export function cleanOutput(text: string): string {
  return text
    .replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function metaAnswer({ options, t, lang }: Context): string {
  const last = options.lastTurn
  if (last === undefined || last === null) return t.metaNothingYet
  if (!last.searchQuery) return t.metaLocal
  const kinds: Record<string, Record<Lang, string>> = {
    email: { tr: 'e-posta', en: 'e-mail', ru: 'e-mail' },
    phone: { tr: 'telefon', en: 'phone', ru: 'телефон' },
  }
  const removed = last.removed.map((k) => kinds[k]?.[lang] ?? k).join(', ')
  return t.metaSearched(last.searchQuery, last.sources, removed)
}

function dateTimeAnswer({ options, t, lang }: Context): string {
  const now = options.now ?? new Date()
  const date = now.toLocaleDateString(LOCALES[lang], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const time = now.toLocaleTimeString(LOCALES[lang], { hour: '2-digit', minute: '2-digit' })
  return t.dateTime(date, time)
}

async function currencyAnswer(ctx: Context, request: { base: string; target: string }): Promise<Omit<AnswerResult, 'intent'>> {
  const { t, lang, options } = ctx
  const query = `${request.base} ${request.target}`
  options.onEvent?.({ type: 'search', query, removed: [] })
  const rate = await fetchRate(request, { ...options.http, signal: options.signal })
  const sources: Source[] = rate ? [{ n: 1, title: t.sources.rates, url: rate.url }] : []
  options.onEvent?.({ type: 'sources', sources })
  if (!rate) return { text: t.noReliableSource, searchQuery: query, sources: [] }
  if (rate.kind === 'unpublished') return { text: t.rateUnpublished(rate.currency), searchQuery: query, sources }
  const date = new Date(`${rate.date}T12:00:00`).toLocaleDateString(LOCALES[lang], { year: 'numeric', month: 'long', day: 'numeric' })
  return {
    text: t.rate(rate.base, rate.target, formatNumber(rate.rate, lang, 4), formatNumber(1 / rate.rate, lang, 6), date),
    searchQuery: query,
    sources,
  }
}

async function weatherAnswer(ctx: Context, places: string[]): Promise<Omit<AnswerResult, 'intent'>> {
  const { t, lang, options } = ctx
  if (places.length === 0) return { text: t.askPlace, sources: [] }
  const http = { ...options.http, signal: options.signal }
  for (const name of places) {
    // only the place name goes out, and the user sees it
    options.onEvent?.({ type: 'search', query: name, removed: [] })
    const place = await geocode(name, lang, http).catch(() => null)
    if (!place) continue
    const weather = await currentWeather(place, http)
    const sources = [{ n: 1, title: `${t.sources.weather}: ${place.name}`, url: weather.url }]
    options.onEvent?.({ type: 'sources', sources })
    return { text: t.weather({ place: place.name, ...weather }), searchQuery: name, sources }
  }
  return { text: t.placeNotFound(places[0]), searchQuery: places[0], sources: [] }
}

const UNITS: Record<string, string> = { Q11573: 'm', Q828224: 'km', Q712226: 'km²', Q174728: 'cm' }

// Capital, population, author... read as data from Wikidata: no model, no prose
// to misread. Returns null when the question is not one of these or nothing is found.
async function factAnswer(ctx: Context): Promise<Omit<AnswerResult, 'intent'> | null> {
  const { question, lang, langs, options, t } = ctx
  const earlierAnswer = [...ctx.history].reverse().find((m) => m.role === 'assistant')?.content
  const request = factRequest(question, earlierAnswer)
  if (!request) return null
  const http = { ...options.http, signal: options.signal }
  // only the name goes out, filtered like every other query
  const subjects = request.subjects.map((s) => toOutgoingQuery(s, langs).query).filter(Boolean)
  if (subjects.length === 0) return null
  options.onEvent?.({ type: 'search', query: subjects[0], removed: [] })

  const found = await Promise.all(subjects.map((s) => wikidataSearch(s, lang, http).catch(() => [] as WikidataEntity[])))
  // a name can end like a suffix (Berlin), so an exact label match wins over the first guess
  // and the other results follow ("Tesla" the unit has no founder, Tesla Motors does)
  const exact = subjects.flatMap((s, i) => found[i].filter((e) => plainName(e.label) === plainName(s)))
  const candidates = [...exact, ...(found.find((f) => f.length) ?? [])]
  const entities = candidates.filter((e, i) => candidates.findIndex((c) => c.id === e.id) === i)
  const fact = await wikidataFact(entities.slice(0, 6), request.properties, lang, http)
  if (!fact) return null

  const values = fact.values.map((v) => {
    if (v.kind === 'item') return v.label
    if (v.kind === 'text') return v.text
    if (v.kind === 'time') return v.time
    const unit = v.unit ? UNITS[v.unit] : undefined
    const amount = `${formatNumber(v.amount, lang, 2)}${unit ? ` ${unit}` : ''}`
    if (!v.date) return amount
    const date = new Date(`${v.date}T12:00:00`).toLocaleDateString(LOCALES[lang], { year: 'numeric', month: 'long', day: 'numeric' })
    return `${amount} (${t.asOf(date)})`
  })
  const sources: Source[] = [{ n: 1, title: `${t.sources.facts}: ${fact.entity.label}`, url: fact.url }]
  options.onEvent?.({ type: 'sources', sources })
  return {
    text: t.fact(fact.entity.label, t.factLabels[request.kind], values.join(', ')),
    searchQuery: subjects[0],
    sources,
  }
}

// Search → read → pick passages → check the evidence → write → verify numbers.
async function researchAnswer(
  ctx: Context,
  { strict }: { strict: boolean },
): Promise<Omit<AnswerResult, 'intent'>> {
  const { question, lang, langs, history, options, t } = ctx
  const { engine, providers = [exchangeRates(), wikipedia(options.http)], signal, onEvent } = options
  const earlier: EarlierTurn | null = searchFollowUpOf(question, history, ctx.uiLang)

  // 1. A short query from the user's own words; personal data removed by rules.
  let draft = ''
  try {
    draft = await rewriteQuery(question, lang, engine, earlier, signal)
  } catch {
    draft = ''
  }
  let outgoing = toOutgoingQuery(draft || keywordQuery(question), langs)
  if (!outgoing.query) outgoing = toOutgoingQuery(keywordQuery(question), langs)
  onEvent?.({ type: 'search', query: outgoing.query, removed: outgoing.removed })

  // 2. Search; if the model's wording finds nothing, try the plain keywords.
  let results = outgoing.query ? await searchAll(providers, outgoing.query, { lang, limit: 4, signal }) : []
  if (results.length === 0) {
    const fallback = toOutgoingQuery(keywordQuery(question), langs).query
    if (fallback && fallback !== outgoing.query) results = await searchAll(providers, fallback, { lang, limit: 4, signal })
  }
  // An official exchange rate answers a rate question on its own; encyclopedia
  // pages next to it are full of old rates that a small model mixes up.
  if (results.some((r) => r.provider === 'rates')) results = results.filter((r) => r.provider === 'rates')
  const sources: Source[] = results.map((r, i) => ({ n: i + 1, title: r.title, url: r.url }))
  onEvent?.({ type: 'sources', sources })

  // 3. Read pages in parallel and keep the most relevant passages.
  const pages = await readPages(results, providers, {
    lang,
    signal,
    cache: options.pageCache,
    onRead: (doneCount, total) => onEvent?.({ type: 'read', done: doneCount, total }),
  })
  const chunks = pages.flatMap((p) => chunkText(p.text, sources.find((s) => s.url === p.url)?.n ?? 0))
  // Encyclopedia articles put the key facts in their opening paragraph, so the
  // lead of the two best results always goes in, then the best keyword matches.
  const leads = sources.slice(0, 2).flatMap((s) => chunks.filter((c) => c.source === s.n).slice(0, 1))
  const best = rankChunks(`${question} ${outgoing.query}`, chunks, 6)
  const top: Chunk[] = [...new Set([...leads, ...best])].slice(0, 6)

  // 4. Evidence check: if the passages are about something else, the model is
  //    not asked at all — "I could not find it" beats a made-up answer.
  const coverage = evidenceCoverage(outgoing.query, top)
  const base = { searchQuery: outgoing.query, removed: outgoing.removed, sources }
  if (top.length === 0 || coverage < (strict ? 1 : 0.5)) {
    return { ...base, text: strict ? t.noReliableRecommendation : t.noReliableSource }
  }

  // 5. Write from those passages only. Not streamed: the text is checked first.
  onEvent?.({ type: 'writing' })
  const raw = await engine.generate(buildPrompt(question, lang, top, sources, history, options.now), { signal })

  // 6. Verify: every number must come from the sources (or the question/date).
  const now = options.now ?? new Date()
  const allowed = `${question} ${now.getFullYear()} ${now.getDate()}`
  const verified = keepVerifiedSentences(cleanOutput(dropInvalidCitations(raw, sources.length)), top.map((c) => c.text).join(' '), allowed)
  return { ...base, text: verified ?? (strict ? t.noReliableRecommendation : t.noReliableSource) }
}
