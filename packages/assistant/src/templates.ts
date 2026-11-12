import type { FactKind } from './facts.ts'
import type { Lang } from '@burrowl/privacy'
import { LOCALES } from './text.ts'

// Answers built from exact data need no model: they are instant and cannot be
// wrong about the numbers.

export function formatNumber(n: number, lang: Lang, maxDigits = 2): string {
  return new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: maxDigits }).format(n)
}

const WEATHER_CODES: Record<Lang, [number[], string][]> = {
  tr: [
    [[0], 'açık'], [[1], 'çoğunlukla açık'], [[2], 'parçalı bulutlu'], [[3], 'kapalı'], [[45, 48], 'sisli'],
    [[51, 53, 55], 'çiseliyor'], [[56, 57], 'donan çisenti'], [[61, 63, 65], 'yağmurlu'], [[66, 67], 'donan yağmur'],
    [[71, 73, 75, 77], 'karlı'], [[80, 81, 82], 'sağanak yağışlı'], [[85, 86], 'kar sağanaklı'], [[95, 96, 99], 'gök gürültülü fırtına'],
  ],
  en: [
    [[0], 'clear'], [[1], 'mostly clear'], [[2], 'partly cloudy'], [[3], 'overcast'], [[45, 48], 'foggy'],
    [[51, 53, 55], 'drizzle'], [[56, 57], 'freezing drizzle'], [[61, 63, 65], 'rain'], [[66, 67], 'freezing rain'],
    [[71, 73, 75, 77], 'snow'], [[80, 81, 82], 'showers'], [[85, 86], 'snow showers'], [[95, 96, 99], 'thunderstorm'],
  ],
  ru: [
    [[0], 'ясно'], [[1], 'преимущественно ясно'], [[2], 'переменная облачность'], [[3], 'пасмурно'], [[45, 48], 'туман'],
    [[51, 53, 55], 'морось'], [[56, 57], 'ледяная морось'], [[61, 63, 65], 'дождь'], [[66, 67], 'ледяной дождь'],
    [[71, 73, 75, 77], 'снег'], [[80, 81, 82], 'ливень'], [[85, 86], 'снегопад'], [[95, 96, 99], 'гроза'],
  ],
}

export function weatherDescription(code: number, lang: Lang): string {
  return WEATHER_CODES[lang].find(([codes]) => codes.includes(code))?.[1] ?? ''
}

interface WeatherParts {
  place: string
  temperature: number
  feelsLike: number
  windKmh: number
  code: number
  time: string
}

interface Templates {
  weather: (w: WeatherParts) => string
  askPlace: string
  placeNotFound: (name: string) => string
  rate: (base: string, target: string, rate: string, inverse: string, date: string) => string
  rateUnpublished: (currency: string) => string
  dateTime: (date: string, time: string) => string
  math: (expression: string, value: string) => string
  metaSearched: (query: string, sources: number, removed: string) => string
  metaLocal: string
  metaNothingYet: string
  askTextToTranslate: string
  noReliableSource: string
  noReliableRecommendation: string
  webOff: string
  checkedAgain: string
  fact: (subject: string, label: string, value: string) => string
  factLabels: Record<FactKind, string>
  asOf: (date: string) => string
  sources: { weather: string; rates: string; facts: string }
}

export const TEMPLATES: Record<Lang, Templates> = {
  tr: {
    weather: (w) =>
      `${w.place}: şu an ${formatNumber(w.temperature, 'tr', 1)}°C, ${weatherDescription(w.code, 'tr')}. ` +
      `Hissedilen ${formatNumber(w.feelsLike, 'tr', 1)}°C, rüzgâr ${formatNumber(w.windKmh, 'tr', 0)} km/sa [1].`,
    askPlace: 'Hangi şehrin hava durumunu istersin?',
    placeNotFound: (name) => `"${name}" adında bir yer bulamadım. Şehrin adını başka şekilde yazar mısın?`,
    rate: (base, target, rate, inverse, date) =>
      `1 ${base} = ${rate} ${target}, 1 ${target} = ${inverse} ${base} [1]. ` +
      `Bu, Avrupa Merkez Bankası'nın ${date} tarihli resmî referans kuru; bankalar ve döviz büroları bu değerin etrafında kendi alış ve satış fiyatlarını uygular.`,
    rateUnpublished: (c) => `${c} için resmî kur bu kaynakta yok: Avrupa Merkez Bankası 2022'den beri ${c} kuru yayınlamıyor.`,
    dateTime: (date, time) => `Bugün ${date}, saat ${time}.`,
    math: (e, v) => `${e} = ${v}`,
    metaSearched: (q, n, removed) =>
      `Evet. Son cevabım için internete yalnızca şu sorgu gitti: "${q}". ${n} kaynak okundu.${removed ? ` Sorgudan çıkarılanlar: ${removed}.` : ''}`,
    metaLocal: 'Hayır. Son cevabımı tamamen cihazda ürettim; internete hiçbir şey gönderilmedi.',
    metaNothingYet: 'Bu sohbette henüz bir cevap vermedim.',
    askTextToTranslate: 'Tabii. Çevirmemi istediğin metni yaz.',
    noReliableSource: 'Bu soruya güvenilir bir kaynakta cevap bulamadım. Uydurmamak için tahmin yürütmüyorum.',
    noReliableRecommendation:
      'Bu konuda güncel ve güvenilir bir kaynak bulamadım, bu yüzden uydurma bir öneri vermiyorum. Bütçeni ve önceliklerini (kamera, pil, oyun gibi) yazarsan nelere dikkat etmen gerektiğini anlatabilirim.',
    webOff: 'Web araması kapalı olduğu için bu bilgiyi alamıyorum. Açmak için yazı kutusunun solundaki dünya simgesine dokun.',
    checkedAgain: 'Tekrar kontrol ettim:',
    fact: (subject, label, value) => `${subject} — ${label}: ${value} [1].`,
    factLabels: { capital: 'başkent', population: 'nüfus', height: 'yükseklik', author: 'yazar', founder: 'kurucu', director: 'yönetmen', currency: 'para birimi', language: 'resmî dil' },
    asOf: (date) => `${date} itibarıyla`,
    sources: { weather: 'Open-Meteo hava durumu', rates: 'Avrupa Merkez Bankası referans kuru', facts: 'Wikidata' },
  },
  en: {
    weather: (w) =>
      `${w.place}: ${formatNumber(w.temperature, 'en', 1)}°C right now, ${weatherDescription(w.code, 'en')}. ` +
      `Feels like ${formatNumber(w.feelsLike, 'en', 1)}°C, wind ${formatNumber(w.windKmh, 'en', 0)} km/h [1].`,
    askPlace: 'Which city would you like the weather for?',
    placeNotFound: (name) => `I could not find a place called "${name}". Could you write the city name differently?`,
    rate: (base, target, rate, inverse, date) =>
      `1 ${base} = ${rate} ${target}, 1 ${target} = ${inverse} ${base} [1]. ` +
      `This is the European Central Bank's official reference rate of ${date}; banks and exchange offices set their own buy and sell prices around it.`,
    rateUnpublished: (c) => `There is no official ${c} rate in this source: the European Central Bank has not published ${c} rates since 2022.`,
    dateTime: (date, time) => `Today is ${date}, ${time}.`,
    math: (e, v) => `${e} = ${v}`,
    metaSearched: (q, n, removed) =>
      `Yes. For my last answer only this query went to the internet: "${q}". ${n} sources were read.${removed ? ` Removed from the query: ${removed}.` : ''}`,
    metaLocal: 'No. My last answer was produced entirely on the device; nothing was sent to the internet.',
    metaNothingYet: 'I have not answered anything in this chat yet.',
    askTextToTranslate: 'Sure. Write the text you want me to translate.',
    noReliableSource: 'I could not find a reliable source that answers this, so I am not guessing.',
    noReliableRecommendation:
      'I could not find current, reliable sources on this, so I am not making up a recommendation. Tell me your budget and priorities (camera, battery, gaming) and I can explain what to look for.',
    webOff: 'Web search is off, so I cannot get this information. Tap the globe next to the text box to turn it on.',
    checkedAgain: 'I checked again:',
    fact: (subject, label, value) => `${subject} — ${label}: ${value} [1].`,
    factLabels: { capital: 'capital', population: 'population', height: 'height', author: 'author', founder: 'founder', director: 'director', currency: 'currency', language: 'official language' },
    asOf: (date) => `as of ${date}`,
    sources: { weather: 'Open-Meteo weather', rates: 'European Central Bank reference rate', facts: 'Wikidata' },
  },
  ru: {
    weather: (w) =>
      `${w.place}: сейчас ${formatNumber(w.temperature, 'ru', 1)}°C, ${weatherDescription(w.code, 'ru')}. ` +
      `Ощущается как ${formatNumber(w.feelsLike, 'ru', 1)}°C, ветер ${formatNumber(w.windKmh, 'ru', 0)} км/ч [1].`,
    askPlace: 'Для какого города показать погоду?',
    placeNotFound: (name) => `Я не нашёл место «${name}». Можете написать название города иначе?`,
    rate: (base, target, rate, inverse, date) =>
      `1 ${base} = ${rate} ${target}, 1 ${target} = ${inverse} ${base} [1]. ` +
      `Это официальный справочный курс Европейского центрального банка на ${date}; банки и обменные пункты устанавливают свои цены покупки и продажи вокруг него.`,
    rateUnpublished: (c) => `Официального курса ${c} в этом источнике нет: Европейский центральный банк не публикует курс ${c} с 2022 года.`,
    dateTime: (date, time) => `Сегодня ${date}, ${time}.`,
    math: (e, v) => `${e} = ${v}`,
    metaSearched: (q, n, removed) =>
      `Да. Для последнего ответа в интернет ушёл только этот запрос: «${q}». Прочитано источников: ${n}.${removed ? ` Удалено из запроса: ${removed}.` : ''}`,
    metaLocal: 'Нет. Последний ответ полностью подготовлен на устройстве; в интернет ничего не отправлялось.',
    metaNothingYet: 'В этом чате я ещё ничего не отвечал.',
    askTextToTranslate: 'Конечно. Напишите текст, который нужно перевести.',
    noReliableSource: 'Я не нашёл надёжного источника с ответом на этот вопрос, поэтому не буду гадать.',
    noReliableRecommendation:
      'Я не нашёл актуальных и надёжных источников, поэтому не буду придумывать рекомендацию. Напишите бюджет и приоритеты (камера, батарея, игры), и я расскажу, на что обратить внимание.',
    webOff: 'Веб-поиск выключен, поэтому я не могу получить эти данные. Нажмите на глобус рядом с полем ввода, чтобы включить его.',
    checkedAgain: 'Я проверил ещё раз:',
    fact: (subject, label, value) => `${subject} — ${label}: ${value} [1].`,
    factLabels: { capital: 'столица', population: 'население', height: 'высота', author: 'автор', founder: 'основатель', director: 'режиссёр', currency: 'валюта', language: 'официальный язык' },
    asOf: (date) => `на ${date}`,
    sources: { weather: 'Погода Open-Meteo', rates: 'Справочный курс ЕЦБ', facts: 'Викиданные' },
  },
}
