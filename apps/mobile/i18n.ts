import { LANGS, type Lang } from '@burrowl/assistant'

export const strings: Record<Lang, {
  greeting: string
  onDevice: string
  placeholder: string
  send: string
  searching: string
}> = {
  tr: {
    greeting: 'Merhaba, nasıl yardımcı olabilirim?',
    onDevice: 'Cihazda çalışır · hesap yok · sohbetler telefondan çıkmaz',
    placeholder: 'Mesajınızı yazın...',
    send: 'Gönder',
    searching: 'Aranıyor',
  },
  en: {
    greeting: 'Hi, how can I help you?',
    onDevice: 'Runs on your device · no account · chats never leave your phone',
    placeholder: 'Type your message...',
    send: 'Send',
    searching: 'Searching',
  },
  ru: {
    greeting: 'Привет! Чем могу помочь?',
    onDevice: 'Работает на устройстве · без аккаунта · чаты не покидают телефон',
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
