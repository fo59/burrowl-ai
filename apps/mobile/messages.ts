import type { Message, StoredMessage } from '@burrowl/assistant'

export function toStored(m: Message): StoredMessage {
  const meta: Record<string, unknown> = {}
  if (m.searchQuery !== undefined) meta.searchQuery = m.searchQuery
  if (m.sources) meta.sources = m.sources
  if (m.removed?.length) meta.removed = m.removed
  if (m.status === 'error') meta.status = 'error'
  return { id: m.id, role: m.role, text: m.text, ...(Object.keys(meta).length ? { meta } : {}) }
}

export function fromStored(s: StoredMessage): Message {
  const meta = (s.meta ?? {}) as Partial<Message>
  return {
    id: s.id,
    role: s.role,
    text: s.text,
    ...meta,
    ...(s.role === 'assistant' ? { status: meta.status ?? 'done' } : {}),
  }
}
