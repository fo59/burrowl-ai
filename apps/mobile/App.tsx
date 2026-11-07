import { useState } from 'react'
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { sanitizeQuery } from '@burrowl/privacy'



export default function App() {
  const [soru, setSoru] = useState('')
  const sonuc = sanitizeQuery(soru)


  return (
    
    <View style={styles.container}>
      <Text style={styles.title}>Burrowl AI'a hoş geldin!</Text>

      <TextInput style={styles.input}
        value={soru}
        onChangeText={setSoru}
      />
      <StatusBar style="auto" />
      <Text style={styles.query}>Internete giden: {sonuc.text}</Text>
      <Text style={styles.label}>Cikarilanlar: {sonuc.removed.join(',')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F044C',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    color: '#EEEEEE',
    fontSize: 24,
    fontWeight: 'bold',
  },
  input: {
    width: 300,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A3480',
    borderRadius: 12,
    backgroundColor: '#141E61',
    color: '#EEEEEE',
  },
  query: {
    color: '#E3A04F',
    fontFamily: 'monospace',
  },
  label: {
    color: '#A3A5B8',
  },
});
