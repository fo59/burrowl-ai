export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

// Storage does not know the assistant's message type; extra fields (sources,
// search query...) travel in `meta` as JSON.
export interface StoredMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  meta?: Record<string, unknown>
}

export interface ChatStore {
  listConversations(): Promise<Conversation[]>
  createConversation(title: string): Promise<Conversation>
  renameConversation(id: string, title: string): Promise<void>
  loadMessages(conversationId: string): Promise<StoredMessage[]>
  // insert or replace by message id
  saveMessage(conversationId: string, message: StoredMessage): Promise<void>
  deleteConversation(id: string): Promise<void>
  deleteAll(): Promise<void>
}

export type SqlValue = string | number | null

// The few calls the store needs; expo-sqlite on the phone and node:sqlite in
// tests both fit behind it.
export interface SqlDatabase {
  exec(sql: string): Promise<void>
  run(sql: string, params?: SqlValue[]): Promise<void>
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// Each entry upgrades the schema by one version; never edit an existing entry.
const MIGRATIONS = [
  `CREATE TABLE conversations (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );
   CREATE TABLE messages (
     conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
     id INTEGER NOT NULL,
     role TEXT NOT NULL,
     text TEXT NOT NULL,
     meta TEXT,
     PRIMARY KEY (conversation_id, id)
   );
   CREATE INDEX messages_by_conversation ON messages (conversation_id, id);`,
]

// After a delete nothing readable may stay behind: overwrite freed pages with
// zeros, empty the write-ahead log and rebuild the file without free pages.
async function wipeFreedSpace(db: SqlDatabase): Promise<void> {
  await db.all('PRAGMA wal_checkpoint(TRUNCATE)')
  await db.exec('VACUUM;')
}

export async function createSqlChatStore(db: SqlDatabase): Promise<ChatStore> {
  await db.exec('PRAGMA foreign_keys = ON;')
  // SQLite normally only marks deleted rows as free; with this it overwrites them.
  await db.exec('PRAGMA secure_delete = ON;')
  const [{ user_version: version }] = await db.all<{ user_version: number }>('PRAGMA user_version')
  for (let v = version; v < MIGRATIONS.length; v++) {
    await db.exec(`BEGIN; ${MIGRATIONS[v]} PRAGMA user_version = ${v + 1}; COMMIT;`)
  }

  return {
    async listConversations() {
      const rows = await db.all<{ id: string; title: string; created_at: number; updated_at: number }>(
        'SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC',
      )
      return rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at }))
    },

    async createConversation(title) {
      const now = Date.now()
      const c = { id: newId(), title, createdAt: now, updatedAt: now }
      await db.run('INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)', [
        c.id, c.title, c.createdAt, c.updatedAt,
      ])
      return c
    },

    async renameConversation(id, title) {
      await db.run('UPDATE conversations SET title = ? WHERE id = ?', [title, id])
    },

    async loadMessages(conversationId) {
      const rows = await db.all<{ id: number; role: 'user' | 'assistant'; text: string; meta: string | null }>(
        'SELECT id, role, text, meta FROM messages WHERE conversation_id = ? ORDER BY id',
        [conversationId],
      )
      return rows.map((r) => ({ id: r.id, role: r.role, text: r.text, ...(r.meta ? { meta: JSON.parse(r.meta) } : {}) }))
    },

    async saveMessage(conversationId, m) {
      await db.run(
        'INSERT OR REPLACE INTO messages (conversation_id, id, role, text, meta) VALUES (?, ?, ?, ?, ?)',
        [conversationId, m.id, m.role, m.text, m.meta ? JSON.stringify(m.meta) : null],
      )
      await db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [Date.now(), conversationId])
    },

    async deleteConversation(id) {
      await db.run('DELETE FROM conversations WHERE id = ?', [id])
      await wipeFreedSpace(db)
    },

    async deleteAll() {
      await db.exec('DELETE FROM conversations;')
      await wipeFreedSpace(db)
    },
  }
}

export interface KeyValue {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

// Used for the browser during development only: browser storage is not
// encrypted. The phone uses the encrypted SQLite store.
export function createKeyValueChatStore(kv: KeyValue, prefix = 'burrowl'): ChatStore {
  const read = <T>(key: string, fallback: T): T => {
    const raw = kv.getItem(`${prefix}:${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  }
  const write = (key: string, value: unknown) => kv.setItem(`${prefix}:${key}`, JSON.stringify(value))
  const conversations = () => read<Conversation[]>('conversations', [])
  const touch = (id: string) =>
    write('conversations', conversations().map((c) => (c.id === id ? { ...c, updatedAt: Date.now() } : c)))

  return {
    async listConversations() {
      return [...conversations()].sort((a, b) => b.updatedAt - a.updatedAt)
    },
    async createConversation(title) {
      const now = Date.now()
      const c = { id: newId(), title, createdAt: now, updatedAt: now }
      write('conversations', [...conversations(), c])
      return c
    },
    async renameConversation(id, title) {
      write('conversations', conversations().map((c) => (c.id === id ? { ...c, title } : c)))
    },
    async loadMessages(conversationId) {
      return read<StoredMessage[]>(`messages:${conversationId}`, [])
    },
    async saveMessage(conversationId, m) {
      const messages = read<StoredMessage[]>(`messages:${conversationId}`, [])
      const others = messages.filter((x) => x.id !== m.id)
      write(`messages:${conversationId}`, [...others, m].sort((a, b) => a.id - b.id))
      touch(conversationId)
    },
    async deleteConversation(id) {
      write('conversations', conversations().filter((c) => c.id !== id))
      kv.removeItem(`${prefix}:messages:${id}`)
    },
    async deleteAll() {
      for (const c of conversations()) kv.removeItem(`${prefix}:messages:${c.id}`)
      kv.removeItem(`${prefix}:conversations`)
    },
  }
}

// Turns the opening question into a short conversation title.
export function titleFrom(text: string, max = 40): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}
