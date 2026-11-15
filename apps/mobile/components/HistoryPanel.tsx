import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { Conversation, Lang } from '@burrowl/assistant'
import type { strings } from '../i18n'
import { colors } from '../theme'
import Icon from './Icon'

interface Props {
  conversations: Conversation[]
  currentId: string | null
  lang: Lang
  t: (typeof strings)['tr']
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onDeleteAll: () => void
  onClose: () => void
}

const LOCALES: Record<Lang, string> = { tr: 'tr-TR', en: 'en-US', ru: 'ru-RU' }

export default function HistoryPanel({ conversations, currentId, lang, t, onOpen, onDelete, onDeleteAll, onClose }: Props) {
  const [confirming, setConfirming] = useState(false)

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.history}</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="close" hitSlop={12}>
          <Icon name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {conversations.length === 0 && <Text style={styles.empty}>{t.noChats}</Text>}
        {conversations.map((c) => (
          <View key={c.id} style={[styles.row, c.id === currentId && styles.rowActive]}>
            <Pressable style={styles.rowMain} onPress={() => onOpen(c.id)} accessibilityRole="button">
              <Text style={styles.rowTitle} numberOfLines={1}>
                {c.title}
              </Text>
              <Text style={styles.rowDate}>
                {new Date(c.updatedAt).toLocaleString(LOCALES[lang], { dateStyle: 'medium', timeStyle: 'short' })}
              </Text>
            </Pressable>
            <Pressable onPress={() => onDelete(c.id)} accessibilityRole="button" accessibilityLabel={t.deleteChat} hitSlop={8}>
              <Icon name="trash" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {conversations.length > 0 && (
        <Pressable
          style={[styles.deleteAll, confirming && styles.deleteAllConfirm]}
          onPress={() => {
            if (!confirming) return setConfirming(true)
            setConfirming(false)
            onDeleteAll()
          }}
          accessibilityRole="button">
          <Icon name="trash" size={16} color={colors.danger} />
          <Text style={styles.deleteAllText}>{confirming ? t.confirmDeleteAll : t.deleteAll}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  list: {
    gap: 8,
  },
  empty: {
    color: colors.textMuted,
    paddingVertical: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  rowActive: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
  },
  rowDate: {
    color: colors.textMuted,
    fontSize: 12,
  },
  deleteAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteAllConfirm: {
    borderColor: colors.danger,
  },
  deleteAllText: {
    color: colors.danger,
  },
})
