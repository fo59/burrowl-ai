import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { fakeEngine, ollamaEngine, type FetchLike } from './index.js'

function streamingResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      const all = lines.join('\n') + '\n'
      const mid = Math.floor(all.length / 2)
      controller.enqueue(encoder.encode(all.slice(0, mid)))
      controller.enqueue(encoder.encode(all.slice(mid)))
      controller.close()
    },
  })
  return new Response(body, { status: 200 })
}

describe('ollamaEngine', () => {
  test('streams tokens and returns the full answer', async () => {
    let request: { url: string; body: unknown } | undefined
    const fetchImpl: FetchLike = async (url, init) => {
      request = { url, body: JSON.parse(String(init?.body)) }
      return streamingResponse([
        JSON.stringify({ message: { content: 'İstanbul ' } }),
        JSON.stringify({ message: { content: '15,7 milyon' } }),
        JSON.stringify({ message: { content: ' [1]' }, done: true }),
      ])
    }
    const tokens: string[] = []
    const engine = ollamaEngine({ model: 'qwen2.5:3b', fetchImpl })
    const text = await engine.generate([{ role: 'user', content: 'soru' }], { onToken: (t) => tokens.push(t) })

    assert.equal(text, 'İstanbul 15,7 milyon [1]')
    assert.deepEqual(tokens, ['İstanbul ', '15,7 milyon', ' [1]'])
    assert.equal(request?.url, 'http://localhost:11434/api/chat')
    assert.deepEqual((request?.body as { model: string; stream: boolean }).model, 'qwen2.5:3b')
  })

  test('reports server errors', async () => {
    const fetchImpl: FetchLike = async () => streamingResponse([JSON.stringify({ error: 'model not found' })])
    await assert.rejects(ollamaEngine({ model: 'x', fetchImpl }).generate([]), /model not found/)
  })
})

describe('fakeEngine', () => {
  test('records the messages it received', async () => {
    const engine = fakeEngine('cevap')
    await engine.generate([{ role: 'user', content: 'merhaba' }])
    assert.equal(engine.calls[0][0].content, 'merhaba')
  })
})
