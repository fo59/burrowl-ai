import { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { reply, LANGS, type Lang, type Message } from '@burrowl/assistant'
import { colors } from './theme'
import { strings, deviceLang } from './i18n'
import BurrowlLogo from './components/BurrowlLogo'
import Icon from './components/Icon'

export default function App() {
  const [lang, setLang] = useState<Lang>(deviceLang)
  const [soru, setSoru] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const bosMu = soru.trim() === ''
  const t = strings[lang]

  function gonder() {
    if (bosMu) return
    const yeni: Message = { id: Date.now(), role: 'user', text: soru.trim() }
    const cevap = reply(soru, Date.now() + 1, lang)
    setMessages([...messages, yeni, cevap])
    setSoru('')
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <BurrowlLogo size={34} />
          <Text style={styles.title}>
            Burrowl <Text style={styles.titleAccent}>AI</Text>
          </Text>
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

      <View style={styles.onDevice}>
        <Icon name="shield" size={14} color={colors.textMuted} />
        <Text style={styles.onDeviceText}>{t.onDevice}</Text>
      </View>

      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
        <View style={[styles.bubble, styles.assistantBubble]}>
          <Text style={styles.assistantText}>{t.greeting}</Text>
        </View>
        {messages.map((m) => (
          <View
            key={m.id}
            style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
            {m.searchQuery && (
              <View style={styles.searchRow}>
                <Icon name="globe" size={14} color={colors.accent} />
                <Text style={styles.searchText}>
                  {t.searching}: {m.searchQuery}
                </Text>
              </View>
            )}
            <Text style={m.role === 'user' ? styles.userText : styles.assistantText}>{m.text}</Text>
          </View>
        ))}
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
          style={[styles.sendButton, bosMu && styles.sendButtonDisabled]}
          onPress={gonder}
          disabled={bosMu}
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
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  onDevice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  onDeviceText: {
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
    maxWidth: 280,
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
