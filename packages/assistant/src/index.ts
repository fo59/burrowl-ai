import { sanitizeQuery } from '@burrowl/privacy'

const yearPattern = /\b(19|20)\d{2}\b/
const keywordPattern = /\b(\bbugün|\bfiyat|\bgüncel|\bson\b|\bhaber|\bborsa)/i

export function needsSearch(question: string): boolean {
  return yearPattern.test(question) || keywordPattern.test(question)
}

export interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
  searchQuery?: string
}

export function reply(question: string, id: number): Message {
  const search = needsSearch(question)
  return {
    id,
    role: 'assistant',
    text: search
      ? 'Bunun için internette arama yapmam gerekiyor. (yakında)'
      : 'Bu soruyu cihazda cevaplayabilirim. (yakında)',
    searchQuery: search ? sanitizeQuery(question).text : undefined,
  }
}
