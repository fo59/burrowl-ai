export interface SearchResult {
  title: string
  url: string
  snippet: string
  provider: string
}

export interface Page {
  title: string
  url: string
  text: string
}

export interface SearchOptions {
  lang: string
  limit?: number
  signal?: AbortSignal
}

export interface SearchProvider {
  name: string
  search(query: string, options: SearchOptions): Promise<SearchResult[]>
  // Providers that know how to get clean text for their own results (Wikipedia's
  // plain-text API) implement this; others fall back to downloading the HTML.
  read?(result: SearchResult, options: SearchOptions): Promise<Page | null>
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export interface HttpOptions {
  timeoutMs?: number
  maxChars?: number
  fetchImpl?: FetchLike
  signal?: AbortSignal
  headers?: Record<string, string>
}

const USER_AGENT = 'BurrowlAI/0.0.1 (privacy-first on-device assistant)'

// Every request starts from scratch: no cookies, no referrer, no cache, and a hard
// time limit so one slow site cannot hold up the answer.
export async function isolatedFetch(url: string, options: HttpOptions = {}): Promise<string> {
  const { timeoutMs = 5000, maxChars = 400_000, fetchImpl = fetch, signal, headers } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
      headers,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    const text = await res.text()
    return text.length > maxChars ? text.slice(0, maxChars) : text
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'",
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z#0-9]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
}

// Keeps only the readable text of a page. Scripts are removed, never run.
export function extractText(html: string): string {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe|template)\b[\s\S]*?<\/\1>/gi, ' ')
  const withBreaks = withoutNoise.replace(/<\/?(p|div|section|article|li|h[1-6]|br|tr|blockquote|pre)\b[^>]*>/gi, '\n')
  return decodeEntities(withBreaks.replace(/<[^>]*>/g, ' '))
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v ]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

export function titleOf(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? stripTags(m[1]) : ''
}

export function wikipedia(http: Omit<HttpOptions, 'signal'> = {}): SearchProvider {
  const headers = { 'Api-User-Agent': USER_AGENT }
  const api = (lang: string, params: Record<string, string>) =>
    `https://${lang}.wikipedia.org/w/api.php?` +
    new URLSearchParams({ format: 'json', origin: '*', utf8: '1', ...params }).toString()

  return {
    name: 'wikipedia',

    async search(query, { lang, limit = 5, signal }) {
      const body = await isolatedFetch(
        api(lang, { action: 'query', list: 'search', srsearch: query, srlimit: String(limit) }),
        { ...http, signal, headers },
      )
      const data = JSON.parse(body) as { query?: { search?: { title: string; snippet: string }[] } }
      return (data.query?.search ?? []).map((r) => ({
        title: r.title,
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
        snippet: stripTags(r.snippet),
        provider: 'wikipedia',
      }))
    },

    async read(result, { lang, signal }) {
      const body = await isolatedFetch(
        api(lang, {
          action: 'query',
          prop: 'extracts',
          explaintext: '1',
          exsectionformat: 'plain',
          redirects: '1',
          titles: result.title,
        }),
        { ...http, signal, headers },
      )
      const data = JSON.parse(body) as { query?: { pages?: Record<string, { title: string; extract?: string }> } }
      const page = Object.values(data.query?.pages ?? {})[0]
      if (!page?.extract) return null
      return { title: page.title, url: result.url, text: page.extract }
    },
  }
}

// Tries providers in order and quietly moves on when one fails, so a blocked or
// broken source never breaks the answer.
export async function searchAll(
  providers: SearchProvider[],
  query: string,
  options: SearchOptions,
): Promise<SearchResult[]> {
  const limit = options.limit ?? 5
  const seen = new Set<string>()
  const results: SearchResult[] = []
  for (const provider of providers) {
    if (results.length >= limit) break
    try {
      for (const r of await provider.search(query, { ...options, limit })) {
        if (!seen.has(r.url)) {
          seen.add(r.url)
          results.push(r)
        }
      }
    } catch {
      // try the next source
    }
  }
  return results.slice(0, limit)
}

// Downloads the pages in parallel; pages that time out or fail are skipped.
export async function readPages(
  results: SearchResult[],
  providers: SearchProvider[],
  options: SearchOptions & {
    http?: Omit<HttpOptions, 'signal'>
    onRead?: (done: number, total: number) => void
    // pages already read in this conversation; follow-up questions reuse them
    // instead of downloading them again
    cache?: Map<string, Page>
  },
): Promise<Page[]> {
  let done = 0
  const settled = await Promise.allSettled(
    results.map(async (r) => {
      try {
        const cached = options.cache?.get(r.url)
        if (cached) return cached
        const provider = providers.find((p) => p.name === r.provider)
        const page = provider?.read
          ? await provider.read(r, options)
          : await isolatedFetch(r.url, { ...options.http, signal: options.signal }).then((html) => ({
              title: titleOf(html) || r.title,
              url: r.url,
              text: extractText(html),
            }))
        // exchange rates change; everything else is kept for the conversation
        if (page && r.provider !== 'rates') options.cache?.set(r.url, page)
        return page
      } finally {
        options.onRead?.(++done, results.length)
      }
    }),
  )
  return settled.flatMap((s) => (s.status === 'fulfilled' && s.value ? [s.value] : []))
}

// --- Exchange rates ----------------------------------------------------------

// Names people use for each currency, folded to plain lowercase letters.
const CURRENCY_NAMES: [string, RegExp][] = [
  ['TRY', /(^|[^\p{L}])(tl|try|lira|turk lirasi|türk lirası|лир)/iu],
  ['USD', /(^|[^\p{L}])(usd|dolar|dollar|доллар)|\$/iu],
  ['EUR', /(^|[^\p{L}])(eur|euro|avro|евро)|€/iu],
  ['GBP', /(^|[^\p{L}])(gbp|sterlin|pound|фунт)|£/iu],
  ['RUB', /(^|[^\p{L}])(rub|ruble|rublesi|рубл)|₽/iu],
  ['JPY', /(^|[^\p{L}])(jpy|yen|иен)/iu],
  ['CHF', /(^|[^\p{L}])(chf|frank|franc|франк)/iu],
]

const RATE_WORDS = /(^|[^\p{L}])(kur|kuru|kaç|kac|döviz|doviz|rate|exchange|convert|курс|сколько|обмен)/iu

const HOME_CURRENCY: Record<string, string> = { tr: 'TRY', ru: 'RUB', en: 'USD' }

// The European Central Bank stopped publishing rouble rates in 2022.
const ECB_MISSING = new Set(['RUB'])

export function currenciesIn(text: string): string[] {
  return CURRENCY_NAMES.map(([code, re]) => ({ code, at: text.search(re) }))
    .filter((c) => c.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((c) => c.code)
}

// Official reference rates from the European Central Bank, served without a key
// by frankfurter.dev. Answers "dolar kaç TL" style questions with a real number.
export interface RateRequest {
  base: string
  target: string
}

// Which pair a question asks about; null when it is not a rate question.
export function rateRequest(text: string, lang: string): RateRequest | null {
  const found = currenciesIn(text)
  // "try" is also an English word; only act on an actual rate question
  const asksRate = found.length >= 2 || RATE_WORDS.test(text)
  if (found.length === 0 || !asksRate) return null
  const home = HOME_CURRENCY[lang] ?? 'USD'
  const base = found[0]
  const target = found[1] ?? (base === home ? (home === 'USD' ? 'EUR' : 'USD') : home)
  return { base, target }
}

export function rateUrl({ base, target }: RateRequest): string {
  return `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${target}`
}

export type Rate =
  | { kind: 'rate'; base: string; target: string; rate: number; date: string; url: string }
  | { kind: 'unpublished'; currency: string; url: string }

// Official reference rate of the European Central Bank (via frankfurter.dev).
export async function fetchRate(request: RateRequest, http: HttpOptions = {}): Promise<Rate | null> {
  const url = rateUrl(request)
  const missing = [request.base, request.target].find((c) => ECB_MISSING.has(c))
  if (missing) return { kind: 'unpublished', currency: missing, url }
  const data = JSON.parse(await isolatedFetch(url, http)) as { date: string; rates: Record<string, number> }
  const rate = data.rates[request.target]
  return rate === undefined ? null : { kind: 'rate', ...request, rate, date: data.date, url }
}

export function exchangeRates(http: Omit<HttpOptions, 'signal'> = {}): SearchProvider {
  return {
    name: 'rates',

    async search(query, { lang }) {
      const request = rateRequest(query, lang)
      if (!request) return []
      return [{ title: `${request.base}/${request.target} (ECB)`, url: rateUrl(request), snippet: '', provider: 'rates' }]
    },

    async read(result, { signal }) {
      const [base, target] = result.title.split(' ')[0].split('/')
      if (ECB_MISSING.has(base) || ECB_MISSING.has(target)) {
        return {
          title: result.title,
          url: result.url,
          text: `The European Central Bank does not publish ${ECB_MISSING.has(base) ? base : target} rates (stopped in 2022), so no official ${base}/${target} rate is available from this source.`,
        }
      }
      const body = await isolatedFetch(result.url, { ...http, signal })
      const data = JSON.parse(body) as { date: string; base: string; rates: Record<string, number> }
      const rate = data.rates[target]
      if (rate === undefined) return null
      return {
        title: result.title,
        url: result.url,
        text:
          `Official reference exchange rate of the European Central Bank on ${data.date}: ` +
          `1 ${base} = ${rate} ${target}; 1 ${target} = ${(1 / rate).toFixed(6)} ${base}. ` +
          'Banks and exchange offices apply their own buy and sell rates around this value.',
      }
    },
  }
}

// --- Weather -----------------------------------------------------------------

export interface Place {
  name: string
  country: string
  latitude: number
  longitude: number
  population: number
}

// "İstanbul", "Istanbul" and "istanbul" are the same name: compare without
// accents and without the Turkish dotted/dotless i difference.
export function plainName(name: string): string {
  return name.replace(/ı/g, 'i').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

// Finds a place by name with Open-Meteo's free geocoder (no key). Only exact
// name matches count: a declined form like "Москве" must not turn into a
// different town with a similar name.
export async function geocode(name: string, lang: string, http: HttpOptions = {}): Promise<Place | null> {
  const url =
    'https://geocoding-api.open-meteo.com/v1/search?' +
    new URLSearchParams({ name, language: lang, count: '10', format: 'json' }).toString()
  const data = JSON.parse(await isolatedFetch(url, http)) as {
    results?: { name: string; country?: string; latitude: number; longitude: number; population?: number }[]
  }
  const wanted = plainName(name)
  const matches = (data.results ?? [])
    .filter((r) => plainName(r.name) === wanted)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
  const r = matches[0]
  return r
    ? { name: r.name, country: r.country ?? '', latitude: r.latitude, longitude: r.longitude, population: r.population ?? 0 }
    : null
}

export interface Weather {
  temperature: number
  feelsLike: number
  windKmh: number
  // WMO weather code (0 clear sky ... 99 thunderstorm with hail)
  code: number
  // local time at the place, "2026-11-12T20:15"
  time: string
  url: string
}

export async function currentWeather(place: Place, http: HttpOptions = {}): Promise<Weather> {
  const url =
    'https://api.open-meteo.com/v1/forecast?' +
    new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
      timezone: 'auto',
    }).toString()
  const data = JSON.parse(await isolatedFetch(url, http)) as {
    current: { time: string; temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number }
  }
  const c = data.current
  return {
    temperature: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    windKmh: c.wind_speed_10m,
    code: c.weather_code,
    time: c.time,
    url,
  }
}


// --- Wikidata (structured facts) ----------------------------------------------

export interface WikidataEntity {
  id: string
  label: string
  description: string
}

export type WikidataValue =
  | { kind: 'item'; id: string; label: string }
  | { kind: 'quantity'; amount: number; unit: string | null; date: string | null }
  | { kind: 'time'; time: string }
  | { kind: 'text'; text: string }

export interface WikidataFact {
  entity: WikidataEntity
  property: string
  values: WikidataValue[]
  url: string
}

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php?'
const wikidataHeaders = { 'Api-User-Agent': USER_AGENT }

async function wikidataGet(params: Record<string, string>, http: HttpOptions): Promise<unknown> {
  const url = WIKIDATA_API + new URLSearchParams({ format: 'json', origin: '*', ...params }).toString()
  return JSON.parse(await isolatedFetch(url, { ...http, headers: { ...http.headers, ...wikidataHeaders } }))
}

export async function wikidataSearch(text: string, lang: string, http: HttpOptions = {}): Promise<WikidataEntity[]> {
  const data = (await wikidataGet(
    { action: 'wbsearchentities', search: text, language: lang, uselang: lang, type: 'item', limit: '5' },
    http,
  )) as { search?: { id: string; label?: string; description?: string }[] }
  return (data.search ?? []).map((r) => ({ id: r.id, label: r.label ?? r.id, description: r.description ?? '' }))
}

interface Claim {
  rank?: string
  mainsnak: { datavalue?: { type: string; value: unknown } }
  qualifiers?: Record<string, { datavalue?: { value: { time?: string } } }[]>
}

// Picks the statements to trust: preferred ones if marked, otherwise the most
// recent by "point in time" (populations change), never deprecated ones.
function bestClaims(claims: Claim[]): Claim[] {
  const usable = claims.filter((c) => c.rank !== 'deprecated' && c.mainsnak.datavalue)
  const preferred = usable.filter((c) => c.rank === 'preferred')
  if (preferred.length) return preferred
  const dated = usable.filter((c) => c.qualifiers?.P585?.[0]?.datavalue?.value.time)
  if (dated.length) {
    return [dated.sort((a, b) => (b.qualifiers!.P585![0].datavalue!.value.time! > a.qualifiers!.P585![0].datavalue!.value.time! ? 1 : -1))[0]]
  }
  return usable
}

// Looks up one property (P36 capital, P1082 population...) of the first
// matching entity that has it.
export async function wikidataFact(
  entities: WikidataEntity[],
  properties: string[],
  lang: string,
  http: HttpOptions = {},
): Promise<WikidataFact | null> {
  // wbgetclaims returns just the asked property (a whole country entity is
  // megabytes). Entities are asked in parallel; several share a name ("Tesla"
  // the unit, the person, the company), and the first one that has it wins.
  for (const property of properties) {
    const answers = await Promise.all(
      entities.map((e) =>
        wikidataGet({ action: 'wbgetclaims', entity: e.id, property }, http)
          .then((d) => ((d as { claims?: Record<string, Claim[]> }).claims?.[property] ?? []))
          .catch(() => [] as Claim[]),
      ),
    )
    const index = answers.findIndex((a) => bestClaims(a).length > 0)
    if (index < 0) continue
    const entity = entities[index]
    const claims = { [property]: answers[index] }
    const raw = bestClaims(claims[property]).slice(0, 3)
    const values: WikidataValue[] = []
    const itemIds: string[] = []
    for (const c of raw) {
      const dv = c.mainsnak.datavalue!
      if (dv.type === 'wikibase-entityid') itemIds.push((dv.value as { id: string }).id)
      else if (dv.type === 'quantity') {
        const v = dv.value as { amount: string; unit: string }
        values.push({
          kind: 'quantity',
          amount: Number(v.amount),
          unit: v.unit && v.unit !== '1' ? v.unit.split('/').pop()! : null,
          date: c.qualifiers?.P585?.[0]?.datavalue?.value.time?.slice(1, 11) ?? null,
        })
      } else if (dv.type === 'time') values.push({ kind: 'time', time: (dv.value as { time: string }).time.slice(1, 11) })
      else if (dv.type === 'string') values.push({ kind: 'text', text: dv.value as string })
      else if (dv.type === 'monolingualtext') values.push({ kind: 'text', text: (dv.value as { text: string }).text })
    }
    if (itemIds.length) {
      const labels = (await wikidataGet(
        { action: 'wbgetentities', ids: itemIds.join('|'), props: 'labels', languages: `${lang}|en` },
        http,
      )) as { entities: Record<string, { labels?: Record<string, { value: string }> }> }
      for (const id of itemIds) {
        const l = labels.entities[id]?.labels
        values.push({ kind: 'item', id, label: l?.[lang]?.value ?? l?.en?.value ?? id })
      }
    }
    if (values.length) return { entity, property, values, url: `https://www.wikidata.org/wiki/${entity.id}` }
  }
  return null
}
