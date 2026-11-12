import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { Message } from '@burrowl/assistant'
import type { strings } from '../i18n'
import { colors } from '../theme'
import Icon from './Icon'

interface Props {
  message: Message
  t: (typeof strings)['tr']
}

function statusText(m: Message, t: Props['t']): string | null {
  if (m.status === 'thinking' || (m.status === 'searching' && !m.sources)) return t.thinking
  if (m.status === 'reading' && m.read) return t.reading(m.read.done, m.read.total)
  if (m.status === 'writing' && !m.text) return t.writing
  return null
}

export default function MessageBubble({ message: m, t }: Props) {
  const status = statusText(m, t)
  const isUser = m.role === 'user'
  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
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
        !!m.text && <Text style={isUser ? styles.userText : styles.assistantText}>{m.text}</Text>
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
}

const styles = StyleSheet.create({
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
})
