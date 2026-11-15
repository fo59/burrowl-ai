import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createKeyValueChatStore,
  createSqlChatStore,
  titleFrom,
  type ChatStore,
  type KeyValue,
  type SqlDatabase,
} from './index.js'

function nodeSqlite(db = new DatabaseSync(':memory:')): SqlDatabase {
  return {
    async exec(sql) {
      db.exec(sql)
    },
    async run(sql, params = []) {
      db.prepare(sql).run(...params)
    },
    async all<T>(sql: string, params: (string | number | null)[] = []) {
      return db.prepare(sql).all(...params) as T[]
    },
  }
}

function memoryKv(): KeyValue {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

function contract(name: string, make: () => Promise<ChatStore>) {
  describe(name, () => {
    test('stores messages of a conversation in order, with their extra fields', async () => {
      const store = await make()
      const c = await store.createConversation('İstanbul nüfusu')
      await store.saveMessage(c.id, { id: 2, role: 'assistant', text: '15,7 milyon [1]', meta: { sources: [{ n: 1, title: 'İstanbul' }] } })
      await store.saveMessage(c.id, { id: 1, role: 'user', text: 'İstanbul nüfusu kaç?' })
      assert.deepEqual(await store.loadMessages(c.id), [
        { id: 1, role: 'user', text: 'İstanbul nüfusu kaç?' },
        { id: 2, role: 'assistant', text: '15,7 milyon [1]', meta: { sources: [{ n: 1, title: 'İstanbul' }] } },
      ])
    })

    test('replaces a message saved again with the same id (streamed answers)', async () => {
      const store = await make()
      const c = await store.createConversation('t')
      await store.saveMessage(c.id, { id: 1, role: 'assistant', text: 'yarım' })
      await store.saveMessage(c.id, { id: 1, role: 'assistant', text: 'tam cevap' })
      assert.deepEqual((await store.loadMessages(c.id)).map((m) => m.text), ['tam cevap'])
    })

    test('lists the most recently used conversation first', async () => {
      const store = await make()
      const a = await store.createConversation('a')
      await new Promise((r) => setTimeout(r, 5))
      const b = await store.createConversation('b')
      await new Promise((r) => setTimeout(r, 5))
      await store.saveMessage(a.id, { id: 1, role: 'user', text: 'x' })
      assert.deepEqual((await store.listConversations()).map((c) => c.title), ['a', 'b'])
      void b
    })

    test('deletes a conversation together with its messages', async () => {
      const store = await make()
      const c = await store.createConversation('silinecek')
      await store.saveMessage(c.id, { id: 1, role: 'user', text: 'x' })
      await store.deleteConversation(c.id)
      assert.deepEqual(await store.listConversations(), [])
      assert.deepEqual(await store.loadMessages(c.id), [])
    })

    test('deletes everything', async () => {
      const store = await make()
      await store.createConversation('a')
      await store.createConversation('b')
      await store.deleteAll()
      assert.deepEqual(await store.listConversations(), [])
    })

    test('renames a conversation', async () => {
      const store = await make()
      const c = await store.createConversation('eski')
      await store.renameConversation(c.id, 'yeni')
      assert.equal((await store.listConversations())[0].title, 'yeni')
    })
  })
}

contract('createSqlChatStore', () => createSqlChatStore(nodeSqlite()))
contract('createKeyValueChatStore', async () => createKeyValueChatStore(memoryKv()))

describe('createSqlChatStore (migrations)', () => {
  test('opening an existing database keeps its data', async () => {
    const raw = new DatabaseSync(':memory:')
    const first = await createSqlChatStore(nodeSqlite(raw))
    const c = await first.createConversation('kalıcı')
    const second = await createSqlChatStore(nodeSqlite(raw))
    assert.equal((await second.listConversations())[0].id, c.id)
  })
})

describe('titleFrom', () => {
  test('shortens long questions', () => {
    assert.equal(titleFrom('bana 2026 yılında alınabilecek fiyat performans odaklı bir telefon öner'), 'bana 2026 yılında alınabilecek fiyat pe…')
  })
})

describe('createSqlChatStore (deleting really deletes)', () => {
  function rawBytes(dir: string): string {
    return readdirSync(dir).map((f) => readFileSync(join(dir, f)).toString('latin1')).join('')
  }

  for (const mode of ['DELETE', 'WAL']) {
    test(`leaves no trace of a deleted chat in the database files (${mode} journal)`, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'burrowl-'))
      try {
        const raw = new DatabaseSync(join(dir, 'chat.db'))
        raw.exec(`PRAGMA journal_mode = ${mode};`)
        const store = await createSqlChatStore(nodeSqlite(raw))
        const secret = 'GIZLI-SORU-1234567890'
        const keep = await store.createConversation('kalacak')
        await store.saveMessage(keep.id, { id: 1, role: 'user', text: 'KALAN-MESAJ' })
        const gone = await store.createConversation(secret)
        await store.saveMessage(gone.id, { id: 1, role: 'user', text: `${secret} hakkında` })
        assert.ok(rawBytes(dir).includes(secret) || mode === 'WAL', 'the secret should be on disk before deleting')

        await store.deleteConversation(gone.id)
        assert.ok(!rawBytes(dir).includes(secret), 'deleted text is still in the database files')
        assert.ok(rawBytes(dir).includes('KALAN-MESAJ'), 'other chats must stay')

        await store.deleteAll()
        assert.ok(!rawBytes(dir).includes('KALAN-MESAJ'))
        raw.close()
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  }
})

