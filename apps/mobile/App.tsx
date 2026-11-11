import { useState } from 'react'
import { StatusBar } from 'expo-status-bar';
import { sanitizeQuery } from '@burrowl/privacy'
import { colors } from './theme'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { needsSearch, Message } from '@burrowl/assistant'



export default function App() {
  const [soru, setSoru] = useState('')
  const sonuc = sanitizeQuery(soru)
  const arama = needsSearch(soru)
  const bosMu = soru.trim() === ''

  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'user', text: 'Merhaba!' },
    { id: 2, role: 'assistant', text: 'Merhaba, nasıl yardımcı olabilirim?' },
  ])
  function gonder() {
    const cevap: Message = {
      id: Date.now() + 1,
      role: 'assistant',
      text: arama
        ? 'Bunun için internette arama yapmam gerekiyor. (yakında)'
        : 'Bu soruyu cihazda cevaplayabilirim. (yakında)',
    }
    if (bosMu) return
    const yeni: Message = { id: Date.now(), role: 'user', text: soru.trim() }
    setMessages([...messages, yeni, cevap])
    setSoru('')
  }

  return (

    <View style={styles.container}>
      <Text style={styles.title}>Burrowl AI'a hoş geldin!</Text>

      <TextInput style={styles.input}
        value={soru}
        onChangeText={setSoru}
      />
      {arama && <Text style={styles.badge}>🌐 Web araması gerekli</Text>}
      <StatusBar style="auto" />
      <Text style={styles.query}>Internete giden: {sonuc.text}</Text>
      <Text style={styles.label}>Cikarilanlar: {sonuc.removed.join(',')}</Text>

      {messages.map((m) => (
        <Text
          key={m.id}
          style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.assistantBubble]}
        >
          {m.text}
        </Text>
      ))}

      <Pressable style={[styles.button, bosMu && styles.buttonDisabled]}
        onPress={gonder} disabled={bosMu}>
        <Text>Gönder</Text>
      </Pressable>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  input: {
    width: 300,
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
    paddingVertical: 10,
    borderRadius: 12,
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
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.text,
    color: colors.background,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    color: colors.text,
  },


});
