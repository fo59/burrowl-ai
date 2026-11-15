import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  answer,
  ollamaEngine,
  titleFrom,
  LANGS,
  type ChatStore,
  type Conversation,
  type Lang,
  type Message,
  type Page,
} from '@burrowl/assistant'
import { colors } from './theme'
import { strings, deviceLang } from './i18n'
import { OLLAMA_MODEL, OLLAMA_URL } from './config'
import { openChatStore } from './chatStore'
import { fromStored, toStored } from './messages'
import BurrowlLogo from './components/BurrowlLogo'
import Icon from './components/Icon'
import MessageBubble from './components/MessageBubble'
import HistoryPanel from './components/HistoryPanel'

type WebMode = 'auto' | 'on' | 'off'
const NEXT_WEB_MODE: Record<WebMode, WebMode> = { auto: 'on', on: 'off', off: 'auto' }

export default function App() {
  const [lang, setLang] = useState<Lang>(deviceLang)
  const [draft, setSoru] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [busy, setBusy] = useState(false)
  const [webMode, setWebMode] = useState<WebMode>('auto')
  const [store, setStore] = useState<ChatStore | null | undefined>(undefined)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const controller = useRef<AbortController | null>(null)
  const pageCache = useRef(new Map<string, Page>())
  const engine = useMemo(() => ollamaEngine({ model: OLLAMA_MODEL, baseUrl: OLLAMA_URL }), [])
  const isEmpty = draft.trim() === ''
  const t = strings[lang]

  useEffect(() => {
    void (async () => {
      const opened = await openChatStore()
      setStore(opened)
      if (!opened) return
      const list = await opened.listConversations()
      setConversations(list)
      if (list[0]) {
        setConversationId(list[0].id)
        setMessages((await opened.loadMessages(list[0].id)).map(fromStored))
      }
    })()
  }, [])

  async function refreshConversations() {
    if (store) setConversations(await store.listConversations())
  }

  function newChat() {
    controller.current?.abort()
    setMessages([])
    setConversationId(null)
    pageCache.current = new Map()
    setShowHistory(false)
  }

  async function openConversation(id: string) {
    if (!store || busy) return
    setConversationId(id)
    setMessages((await store.loadMessages(id)).map(fromStored))
    pageCache.current = new Map()
    setShowHistory(false)
  }

  async function deleteConversation(id: string) {
    if (!store) return
    await store.deleteConversation(id)
    if (id === conversationId) newChat()
    await refreshConversations()
  }

  async function deleteAll() {
    if (!store) return
    await store.deleteAll()
    newChat()
    setConversations([])
  }

  async function send() {
    if (isEmpty || busy) return
    const question = draft.trim()
    const id = Date.now()
    const history = messages
      .filter((m) => m.text && (m.role === 'user' || m.status === 'done'))
      .map((m) => ({ role: m.role, content: m.text }))
    const previous = [...messages].reverse().find((m) => m.role === 'assistant' && m.status === 'done')
    const lastTurn = previous
      ? { searchQuery: previous.searchQuery, sources: previous.sources?.length ?? 0, removed: previous.removed ?? [] }
      : null

    const userMessage: Message = { id, role: 'user', text: question }
    let reply: Message = { id: id + 1, role: 'assistant', text: '', status: 'thinking' }
    setMessages((prev) => [...prev, userMessage, reply])
    setSoru('')
    setBusy(true)

    let convId = conversationId
    if (store && !convId) {
      convId = (await store.createConversation(titleFrom(question))).id
      setConversationId(convId)
    }
    if (store && convId) await store.saveMessage(convId, toStored(userMessage))

    const update = (change: Partial<Message>) => {
      reply = { ...reply, ...change }
      const snapshot = reply
      setMessages((prev) => prev.map((m) => (m.id === snapshot.id ? snapshot : m)))
    }

    const abort = new AbortController()
    controller.current = abort
    try {
      const result = await answer(question, lang, {
        engine,
        history,
        lastTurn,
        web: webMode,
        signal: abort.signal,
        pageCache: pageCache.current,
        onEvent: (e) => {
          if (e.type === 'search') update({ status: 'searching', searchQuery: e.query, removed: e.removed })
          else if (e.type === 'sources') update({ sources: e.sources })
          else if (e.type === 'read') update({ status: 'reading', read: { done: e.done, total: e.total } })
          else if (e.type === 'writing') update({ status: 'writing' })
          else if (e.type === 'token') update({ text: reply.text + e.text })
        },
      })
      update({ status: 'done', text: result.text })
    } catch {
      if (abort.signal.aborted) update({ status: 'done', text: `${reply.text} ${t.stopped}`.trim() })
      else update({ status: 'error' })
    } finally {
      controller.current = null
      setBusy(false)
      if (store && convId) {
        await store.saveMessage(convId, toStored(reply))
        await refreshConversations()
      }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <BurrowlLogo size={38} />
          <View style={styles.brandText}>
            <Text style={styles.title} numberOfLines={1}>
              Burrowl <Text style={styles.titleAccent}>AI</Text>
            </Text>
            <View style={styles.slogan}>
              <Icon name="shield" size={12} color={colors.textMuted} />
              <Text style={styles.sloganText} numberOfLines={1}>
                {t.slogan}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setShowHistory(true)} accessibilityRole="button" accessibilityLabel={t.history} hitSlop={8}>
            <Icon name="history" size={20} color={colors.text} />
          </Pressable>
          <Pressable onPress={newChat} accessibilityRole="button" accessibilityLabel={t.newChat} hitSlop={8}>
            <Icon name="plus" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.langSwitch}>
            {LANGS.map((l) => (
              <Pressable
                key={l}
                onPress={() => setLang(l)}
                accessibilityRole="button"
                accessibilityState={{ selected: l === lang }}
                style={[styles.langButton, l === lang && styles.langButtonActive]}>
                <Text style={[styles.langText, l === lang && styles.langTextActive]}>{l.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {store === null && <Text style={styles.notice}>{t.notSaved}</Text>}
        <MessageBubble message={{ id: 0, role: 'assistant', text: t.greeting }} t={t} />
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} t={t} />
        ))}
      </ScrollView>

      {webMode !== 'auto' && <Text style={styles.webModeLabel}>{t.web[webMode]}</Text>}
      <View style={styles.bottomBar}>
        <Pressable
          style={styles.webButton}
          onPress={() => setWebMode(NEXT_WEB_MODE[webMode])}
          accessibilityRole="button"
          accessibilityLabel={t.web[webMode]}
          hitSlop={6}>
          <Icon
            name={webMode === 'off' ? 'globeOff' : 'globe'}
            size={22}
            color={webMode === 'on' ? colors.accent : colors.textMuted}
          />
        </Pressable>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setSoru}
          onSubmitEditing={send}
          placeholder={t.placeholder}
          placeholderTextColor={colors.textMuted}
        />
        {busy ? (
          <Pressable
            style={styles.sendButton}
            onPress={() => controller.current?.abort()}
            accessibilityRole="button"
            accessibilityLabel={t.stop}>
            <Icon name="stop" size={18} color={colors.onAccent} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.sendButton, isEmpty && styles.sendButtonDisabled]}
            onPress={send}
            disabled={isEmpty}
            accessibilityRole="button"
            accessibilityLabel={t.send}>
            <Icon name="arrowUp" size={20} color={colors.onAccent} />
          </Pressable>
        )}
      </View>

      {showHistory && (
        <HistoryPanel
          conversations={conversations}
          currentId={conversationId}
          lang={lang}
          t={t}
          onOpen={openConversation}
          onDelete={deleteConversation}
          onDeleteAll={deleteAll}
          onClose={() => setShowHistory(false)}
        />
      )}

      <StatusBar style="light" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  brandText: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  titleAccent: {
    color: colors.accent,
  },
  slogan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sloganText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  langSwitch: {
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  langButtonActive: {
    backgroundColor: colors.text,
  },
  langText: {
    color: colors.textMuted,
    fontWeight: 'bold',
    fontSize: 12,
  },
  langTextActive: {
    color: colors.background,
  },
  messages: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    gap: 8,
    paddingVertical: 12,
  },
  notice: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 4,
  },
  webModeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  webButton: {
    width: 36,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.35,
  },
})
