import type { Lang } from '@burrowl/privacy'

// JavaScript's \b only treats ASCII letters as word characters; these work for every script.
export const B = String.raw`(?<![\p{L}\p{N}])`
export const E = String.raw`(?![\p{L}\p{N}])`

// People often type Turkish without its special letters ("guncel", "oner").
// Matching is done on a folded form so both spellings count. The result keeps
// the same length as the input, so positions found in it apply to the original.
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

// "Türkiye'nin" → "Türkiye": the suffix after an apostrophe only hurts searching.
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
