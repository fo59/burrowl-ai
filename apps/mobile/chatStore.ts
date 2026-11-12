import { createKeyValueChatStore, type ChatStore } from '@burrowl/assistant'

// Browser (development) build. Browser storage is not encrypted, which is fine
// for testing on a computer; the phone build uses chatStore.native.ts.
export async function openChatStore(): Promise<ChatStore | null> {
  try {
    return createKeyValueChatStore(window.localStorage)
  } catch {
    return null
  }
}
