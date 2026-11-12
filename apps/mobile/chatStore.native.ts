import * as SQLite from 'expo-sqlite'
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import { createSqlChatStore, type ChatStore, type SqlDatabase } from '@burrowl/assistant'

const KEY_NAME = 'burrowl.db.key'

// A random key made on first launch and kept in the phone's Keychain/Keystore.
async function databaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME)
  if (existing) return existing
  const bytes = Crypto.getRandomBytes(32)
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  await SecureStore.setItemAsync(KEY_NAME, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
  return key
}

// Opens the encrypted chat database. Returns null when encryption is not
// available, so chats stay in memory only: data that is not stored cannot be
// stolen, and an unencrypted database is never written.
export async function openChatStore(): Promise<ChatStore | null> {
  try {
    const db = await SQLite.openDatabaseAsync('burrowl.db')
    // Without SQLCipher in the build, PRAGMA key fails silently and the file
    // would be stored in plain text, so check before using it.
    const cipher = await db.getAllAsync<{ cipher_version: string }>('PRAGMA cipher_version')
    if (cipher.length === 0) {
      await db.closeAsync()
      return null
    }
    // the key is 64 hex characters we made ourselves, so it is safe to inline
    await db.execAsync(`PRAGMA key = "x'${await databaseKey()}'"`)

    const sql: SqlDatabase = {
      exec: (source) => db.execAsync(source),
      run: async (source, params = []) => {
        await db.runAsync(source, params)
      },
      all: (source, params = []) => db.getAllAsync(source, params),
    }
    return await createSqlChatStore(sql)
  } catch {
    return null
  }
}
