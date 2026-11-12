import { LANGS, type Lang } from '@burrowl/assistant'

interface Strings {
  greeting: string
  slogan: string
  placeholder: string
  send: string
  searching: string
  thinking: string
  reading: (done: number, total: number) => string
  writing: string
  sources: string
  removedFromQuery: string
  noSources: string
  error: string
  kinds: Record<string, string>
}

export const strings: Record<Lang, Strings> = {
  tr: {
    greeting: 'Merhaba, nasıl yardımcı olabilirim?',
    slogan: 'Sorduğun her şey sende kalır.',
    placeholder: 'Mesajınızı yazın...',
    send: 'Gönder',
    searching: 'Aranıyor',
    thinking: 'Düşünüyor…',
    reading: (done, total) => `${total} kaynak okunuyor (${done}/${total})`,
    writing: 'Cevap yazılıyor…',
    sources: 'Kaynaklar',
    removedFromQuery: 'Sorgudan çıkarıldı',
    noSources: 'Kaynak bulunamadı',
    error: 'Cevap üretilemedi. Ollama bilgisayarda çalışıyor mu?',
    kinds: { email: 'e-posta', phone: 'telefon', iban: 'IBAN', card: 'kart no', tc: 'TC kimlik no', passport: 'pasaport no', snils: 'SNILS', ssn: 'SSN' },
  },
  en: {
    greeting: 'Hi, how can I help you?',
    slogan: 'Everything you ask stays with you.',
    placeholder: 'Type your message...',
    send: 'Send',
    searching: 'Searching',
    thinking: 'Thinking…',
    reading: (done, total) => `Reading ${total} sources (${done}/${total})`,
    writing: 'Writing the answer…',
    sources: 'Sources',
    removedFromQuery: 'Removed from the query',
    noSources: 'No sources found',
    error: 'Could not generate an answer. Is Ollama running on the computer?',
    kinds: { email: 'e-mail', phone: 'phone', iban: 'IBAN', card: 'card number', tc: 'Turkish ID', passport: 'passport no', snils: 'SNILS', ssn: 'SSN' },
  },
  ru: {
    greeting: 'Привет! Чем могу помочь?',
    slogan: 'Всё, что вы спрашиваете, остаётся с вами.',
    placeholder: 'Напишите сообщение...',
    send: 'Отправить',
    searching: 'Ищу',
    thinking: 'Думаю…',
    reading: (done, total) => `Читаю источники: ${done}/${total}`,
    writing: 'Пишу ответ…',
    sources: 'Источники',
    removedFromQuery: 'Удалено из запроса',
    noSources: 'Источники не найдены',
    error: 'Не удалось получить ответ. Запущен ли Ollama на компьютере?',
    kinds: { email: 'e-mail', phone: 'телефон', iban: 'IBAN', card: 'номер карты', tc: 'турецкий ID', passport: 'паспорт', snils: 'СНИЛС', ssn: 'SSN' },
  },
}

// Start in the phone's language without asking (zero setup); English otherwise.
export function deviceLang(): Lang {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2).toLowerCase()
  return (LANGS as string[]).includes(locale) ? (locale as Lang) : 'en'
}
