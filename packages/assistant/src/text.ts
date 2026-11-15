import type { Lang } from '@burrowl/privacy'

export const B = String.raw`(?<![\p{L}\p{N}])`
export const E = String.raw`(?![\p{L}\p{N}])`

export function foldTurkish(text: string): string {
  return text
    .replace(/[İI]/g, 'i')
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
}

export function stripSuffixes(text: string): string {
  return text.replace(/(\p{L})['’]\p{L}+/gu, '$1')
}

export function escapeRegExp(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function detectLanguage(text: string, fallback: Lang): Lang {
  if (/\p{Script=Cyrillic}/u.test(text)) return 'ru'
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return 'tr'
  return fallback
}

export function words(text: string): string[] {
  return text.split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean)
}

export const LOCALES: Record<Lang, string> = { tr: 'tr-TR', en: 'en-US', ru: 'ru-RU' }
