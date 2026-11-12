import { useState } from 'react'
import { StatusBar } from 'expo-status-bar';
import { colors } from './theme'
import { Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native'
import { reply, LANGS, type Lang, type Message } from '@burrowl/assistant'
import { strings, deviceLang } from './i18n'

export default function App() {
  const [lang, setLang] = useState<Lang>(deviceLang)
  const [soru, setSoru] = useState('')
  const bosMu = soru.trim() === ''
  const t = strings[lang]

  const [messages, setMessages] = useState<Message[]>([])

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
        <Text style={styles.title}>Burrowl AI</Text>
        <View style={styles.langSwitch}>
          {LANGS.map((l) => (
            <Pressable
              key={l}
              onPress={() => setLang(l)}
              style={[styles.langButton, l === lang && styles.langButtonActive]}>
              <Text style={[styles.langText, l === lang && styles.langTextActive]}>
                {l.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
        <View style={[styles.bubble, styles.assistantBubble]}>
          <Text style={styles.assistantText}>{t.greeting}</Text>
        </View>
        {messages.map((m) => (
          <View
            key={m.id}
            style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
            {m.searchQuery && <Text style={styles.query}>🌐 {t.searching}: {m.searchQuery}</Text>}
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
          style={[styles.button, bosMu && styles.buttonDisabled]}
          onPress={gonder}
          disabled={bosMu}>
          <Text style={styles.buttonText}>{t.send}</Text>
        </Pressable>
      </View>

      <StatusBar style='light' />
    </View>
  );
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
    marginBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: 'bold',
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
  input: {
    flex: 1,
    // On web a text input has an intrinsic width; without this it pushes the row off-screen.
    minWidth: 0,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    color: colors.text,
  },
  query: {
    color: colors.internet,
    fontFamily: 'monospace',
  },
  label: {
    color: colors.textMuted,
  },
  badge: {
    color: colors.background,
    backgroundColor: colors.internet,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: 'bold',
  },
  message: {
    color: colors.text,
  },
  button: {
    backgroundColor: colors.text,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: colors.background,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.4,
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
    backgroundColor: colors.card,
  },
  userText: {
    color: colors.background,
  },
  assistantText: {
    color: colors.text,
  },
  messages: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    gap: 8,
    paddingVertical: 12,
  },
  bottomBar: {
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
