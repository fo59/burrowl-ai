import { useState } from 'react'
import { StatusBar } from 'expo-status-bar';
import { colors } from './theme'
import { Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native'
import { reply, Message } from '@burrowl/assistant'

export default function App() {
  const [soru, setSoru] = useState('')
  const bosMu = soru.trim() === ''

  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'user', text: 'Merhaba!' },
    { id: 2, role: 'assistant', text: 'Merhaba, nasıl yardımcı olabilirim?' },
  ])

  function gonder() {
    if (bosMu) return
    const yeni: Message = { id: Date.now(), role: 'user', text: soru.trim() }
    const cevap = reply(soru, Date.now() + 1)
    setMessages([...messages, yeni, cevap])
    setSoru('')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Burrowl AI'a hoş geldin!</Text>

      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
        {messages.map((m) => (
          <View
            key={m.id}
            style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
            {m.searchQuery && <Text style={styles.query}>🌐 Aranıyor: {m.searchQuery}</Text>}
            <Text style={m.role === 'user' ? styles.userText : styles.assistantText}>{m.text}</Text>
          </View>
        ))}
      </ScrollView>
      
      <View style={styles.bottomBar}>  
        <TextInput 
          style={styles.input}
          value={soru}
          onChangeText={setSoru}
          placeholder="Mesajınızı yazın..."
          placeholderTextColor={colors.textMuted}
        />
        <Pressable 
          style={[styles.button, bosMu && styles.buttonDisabled]}
          onPress={gonder} 
          disabled={bosMu}>
          <Text style={styles.buttonText}>Gönder</Text>
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
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  input: {
    flex: 1, // Sabit width: 300 kaldırıldı, kalan tüm genişliği kaplar
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
