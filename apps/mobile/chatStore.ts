import { createKeyValueChatStore, type ChatStore } from '@burrowl/assistant'

export async function openChatStore(): Promise<ChatStore | null> {
  try {
    return createKeyValueChatStore(window.localStorage)
  } catch {
    return null
  }
}
