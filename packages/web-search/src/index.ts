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
  options: SearchOptions & { http?: Omit<HttpOptions, 'signal'>; onRead?: (done: number, total: number) => void },
): Promise<Page[]> {
  let done = 0
  const settled = await Promise.allSettled(
    results.map(async (r) => {
      try {
        const provider = providers.find((p) => p.name === r.provider)
        if (provider?.read) return await provider.read(r, options)
        const html = await isolatedFetch(r.url, { ...options.http, signal: options.signal })
        return { title: titleOf(html) || r.title, url: r.url, text: extractText(html) }
      } finally {
        options.onRead?.(++done, results.length)
      }
    }),
  )
  return settled.flatMap((s) => (s.status === 'fulfilled' && s.value ? [s.value] : []))
}
