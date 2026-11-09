import { useState } from 'react'
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { sanitizeQuery } from '@burrowl/privacy'
import { needsSearch } from '@burrowl/assistant'
import { colors } from './theme'
import { Message } from '@burrowl/assistant'
import { Pressable } from 'react-native';




export default function App() {
  const [soru, setSoru] = useState('')
  const sonuc = sanitizeQuery(soru)
  const arama = needsSearch(soru)

  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'user', text: 'Merhaba!' },
    { id: 2, role: 'assistant', text: 'Merhaba, nasıl yardımcı olabilirim?' },
  ])
    function gonder() {
    const yeni: Message = { id: Date.now(), role: 'user', text: soru }
    setMessages([...messages, yeni])
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
        <Text key={m.id} style={styles.message}>{m.role}: {m.text}</Text>
      ))}
      <Pressable onPress={gonder}>
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

});
