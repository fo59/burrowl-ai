import { LANGS, type Lang } from '@burrowl/assistant'

export const strings: Record<Lang, {
  greeting: string
  slogan: string
  placeholder: string
  send: string
  searching: string
}> = {
  tr: {
    greeting: 'Merhaba, nasıl yardımcı olabilirim?',
    slogan: 'Sorduğun her şey sende kalır.',
    placeholder: 'Mesajınızı yazın...',
    send: 'Gönder',
    searching: 'Aranıyor',
  },
  en: {
    greeting: 'Hi, how can I help you?',
    slogan: 'Everything you ask stays with you.',
    placeholder: 'Type your message...',
    send: 'Send',
    searching: 'Searching',
  },
  ru: {
    greeting: 'Привет! Чем могу помочь?',
    slogan: 'Всё, что вы спрашиваете, остаётся с вами.',
    placeholder: 'Напишите сообщение...',
    send: 'Отправить',
    searching: 'Ищу',
  },
}

// Start in the phone's language without asking (zero setup); English otherwise.
export function deviceLang(): Lang {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2).toLowerCase()
  return (LANGS as string[]).includes(locale) ? (locale as Lang) : 'en'
}
