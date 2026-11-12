export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GenerateOptions {
  onToken?: (token: string) => void
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
}

// The orchestrator only knows this interface. Ollama is used while developing
// on a computer; on the phone the same interface is backed by llama.rn.
export interface LlmEngine {
  name: string
  generate(messages: ChatMessage[], options?: GenerateOptions): Promise<string>
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export interface OllamaOptions {
  model: string
  baseUrl?: string
  fetchImpl?: FetchLike
}

// Development-only engine: talks to an Ollama server on the same computer
// (http://localhost:11434). It is never part of the shipped app.
export function ollamaEngine({ model, baseUrl = 'http://localhost:11434', fetchImpl = fetch }: OllamaOptions): LlmEngine {
  return {
    name: `ollama:${model}`,

    async generate(messages, { onToken, signal, temperature = 0.2, maxTokens = 512 } = {}) {
      const res = await fetchImpl(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          options: { temperature, num_predict: maxTokens },
        }),
        signal,
      })
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)

      let full = ''
      const handleLine = (line: string) => {
        if (!line.trim()) return
        const data = JSON.parse(line) as { message?: { content?: string }; error?: string }
        if (data.error) throw new Error(data.error)
        const token = data.message?.content ?? ''
        if (token) {
          full += token
          onToken?.(token)
        }
      }

      // Ollama streams one JSON object per line.
      const reader = res.body?.getReader()
      if (!reader) {
        for (const line of (await res.text()).split('\n')) handleLine(line)
        return full
      }
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) handleLine(line)
      }
      handleLine(buffer)
      return full
    },
  }
}

// Deterministic engine for tests: returns a fixed answer, streamed word by word.
export function fakeEngine(answer: string | ((messages: ChatMessage[]) => string)): LlmEngine & { calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = []
  return {
    name: 'fake',
    calls,
    async generate(messages, { onToken } = {}) {
      calls.push(messages)
      const text = typeof answer === 'function' ? answer(messages) : answer
      for (const piece of text.split(/(?<= )/)) onToken?.(piece)
      return text
    },
  }
}
