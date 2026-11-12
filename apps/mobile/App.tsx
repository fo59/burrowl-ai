import { useMemo, useRef, useState, type ComponentRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { answer, ollamaEngine, LANGS, type Lang, type Message } from '@burrowl/assistant'
import { colors } from './theme'
import { strings, deviceLang } from './i18n'
import { OLLAMA_MODEL, OLLAMA_URL } from './config'
import BurrowlLogo from './components/BurrowlLogo'
import Icon from './components/Icon'

export default function App() {
  const [lang, setLang] = useState<Lang>(deviceLang)
  const [soru, setSoru] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [busy, setBusy] = useState(false)
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const engine = useMemo(() => ollamaEngine({ model: OLLAMA_MODEL, baseUrl: OLLAMA_URL }), [])
  const bosMu = soru.trim() === ''
  const t = strings[lang]

  async function gonder() {
    if (bosMu || busy) return
    const question = soru.trim()
    const id = Date.now()
    // Finished turns of this conversation, so follow-up questions have context.
    const history = messages
      .filter((m) => m.text && (m.role === 'user' || m.status === 'done'))
      .map((m) => ({ role: m.role, content: m.text }))
    setMessages((prev) => [
      ...prev,
      { id, role: 'user', text: question },
      { id: id + 1, role: 'assistant', text: '', status: 'thinking' },
    ])
    setSoru('')
    setBusy(true)

    // Updates arrive while the answer is being built, so always patch the latest state.
    const patch = (change: (m: Message) => Partial<Message>) =>
      setMessages((prev) => prev.map((m) => (m.id === id + 1 ? { ...m, ...change(m) } : m)))

    try {
      const result = await answer(question, lang, {
        engine,
        history,
        onEvent: (e) => {
          if (e.type === 'search') patch(() => ({ status: 'searching', searchQuery: e.query, removed: e.removed }))
          else if (e.type === 'sources') patch(() => ({ sources: e.sources }))
          else if (e.type === 'read') patch(() => ({ status: 'reading', read: { done: e.done, total: e.total } }))
          else if (e.type === 'writing') patch(() => ({ status: 'writing' }))
          else if (e.type === 'token') patch((m) => ({ text: m.text + e.text }))
        },
      })
      // the final text has citations to non-existent sources removed
      patch(() => ({ status: 'done', text: result.text }))
    } catch {
      patch(() => ({ status: 'error' }))
    } finally {
      setBusy(false)
    }
  }

  function statusText(m: Message): string | null {
    if (m.status === 'thinking' || (m.status === 'searching' && !m.sources)) return t.thinking
    if (m.status === 'reading' && m.read) return t.reading(m.read.done, m.read.total)
    if (m.status === 'writing' && !m.text) return t.writing
    return null
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
        <View style={styles.langSwitch}>
          {LANGS.map((l) => (
            <Pressable
              key={l}
              onPress={() => setLang(l)}
              accessibilityRole="button"
              accessibilityState={{ selected: l === lang }}
              style={[styles.langButton, l === lang && styles.langButtonActive]}>
              <Text style={[styles.langText, l === lang && styles.langTextActive]}>
                {l.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        ref={scroll}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        <View style={[styles.bubble, styles.assistantBubble]}>
          <Text style={styles.assistantText}>{t.greeting}</Text>
        </View>
        {messages.map((m) => {
          const status = statusText(m)
          return (
            <View
              key={m.id}
              style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
              {m.searchQuery !== undefined && (
                <View style={styles.searchRow}>
                  <Icon name="globe" size={14} color={colors.accent} />
                  <Text style={styles.searchText}>
                    {t.searching}: {m.searchQuery}
                  </Text>
                </View>
              )}
              {m.removed && m.removed.length > 0 && (
                <Text style={styles.meta}>
                  {t.removedFromQuery}: {m.removed.map((k) => t.kinds[k] ?? k).join(', ')}
                </Text>
              )}
              {status && <Text style={styles.meta}>{status}</Text>}
              {m.status === 'error' ? (
                <Text style={styles.errorText}>{t.error}</Text>
              ) : (
                !!m.text && <Text style={m.role === 'user' ? styles.userText : styles.assistantText}>{m.text}</Text>
              )}
              {m.status === 'done' && m.sources && (
                <View style={styles.sources}>
                  <Text style={styles.meta}>{m.sources.length ? t.sources : t.noSources}</Text>
                  {m.sources.map((s) => (
                    <Pressable key={s.n} onPress={() => Linking.openURL(s.url)} accessibilityRole="link">
                      <Text style={styles.sourceText} numberOfLines={1}>
                        <Text style={styles.sourceNumber}>[{s.n}] </Text>
                        {s.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TextInput
          style={styles.input}
          value={soru}
          onChangeText={setSoru}
          onSubmitEditing={gonder}
          placeholder={t.placeholder}
          placeholderTextColor={colors.textMuted}
        />
        <Pressable
          style={[styles.sendButton, (bosMu || busy) && styles.sendButtonDisabled]}
          onPress={gonder}
          disabled={bosMu || busy}
          accessibilityRole="button"
          accessibilityLabel={t.send}>
          <Icon name="arrowUp" size={20} color={colors.onAccent} />
        </Pressable>
      </View>

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
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  titleAccent: {
    color: colors.accent,
  },
  langSwitch: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langButton: {
    paddingHorizontal: 10,
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
  brandText: {
    flexShrink: 1,
    gap: 2,
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
  messages: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    gap: 8,
    paddingVertical: 12,
  },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    gap: 6,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.text,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
  },
  userText: {
    color: colors.background,
  },
  assistantText: {
    color: colors.text,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchText: {
    flexShrink: 1,
    color: colors.accent,
    fontFamily: 'monospace',
    fontSize: 13,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  errorText: {
    color: colors.danger,
  },
  sources: {
    gap: 4,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sourceText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  sourceNumber: {
    color: colors.accent,
    fontWeight: 'bold',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    // On web a text input has an intrinsic width; without this it pushes the row off-screen.
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
