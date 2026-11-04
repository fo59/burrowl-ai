# Burrowl AI — Temel Prensipler

Bu belge projenin anayasasıdır. Her özellik, her kod değişikliği ve her tasarım kararı bu prensiplere uymak zorundadır. Bir prensiple çelişen bir öneri, ne kadar kârlı veya faydalı görünürse görünsün kabul edilmez.

---

## 1. Kullanıcı verisi tutan sunucu yok

Projenin kullanıcı verisi toplayan, saklayan veya işleyen hiçbir sunucusu yoktur ve olmayacaktır.

- Analitik, telemetri veya kullanım takibi yoktur.
- Model dosyaları yalnızca herkese açık depolardan (ör. Hugging Face) indirilir.

## 2. Her şey telefonda

Yapay zekâ ve kullanıcıya ait her şey kullanıcının cihazında kalır.

- Yapay zekâ modeli telefonda çalışır.
- Sohbet geçmişi telefonda saklanır.
- Hafıza ve kişisel bilgi kütüphanesi telefonda saklanır.
- Belgeler ve görseller telefonda analiz edilir.

## 3. Arama telefondan yapılır

Web araştırması, uygulamanın kendi izole bağlantısıyla doğrudan telefondan yapılır.

- Kullanıcının kişisel tarayıcısı (Chrome, Safari vb.) kullanılmaz.
- Arama bağlantısı çerez, oturum veya geçmiş tutmaz; her arama sıfırdan başlar.
- İnternete yalnızca yapay zekânın ürettiği kısa arama sorgusu gider.
- Sorgular gönderilmeden önce kişisel bilgilerden (isim, telefon, e-posta, kimlik no, IBAN vb.) arındırılır.
- Kullanıcı internete gönderilen her sorguyu sohbet ekranında görür.
- Uygulama CAPTCHA veya bot korumalarını aşmaya çalışmaz.

## 4. Sıfır kurulum, hesap yok

Uygulama teknik bilgi gerektirmez.

- Hesap yok.
- API anahtarı yok.
- Sunucu adresi veya teknik ayar yok.
- Kullanıcı uygulamayı indirir, önerilen modeli indirir ve kullanmaya başlar.

## 5. Gizlilik asla ücretli değildir

Uygulama reklamsızdır.

- Şifreleme, uygulama kilidi, sorgu filtresi ve veri silme her zaman ücretsizdir.
- Kullanıcı verisi satılmaz, reklam için kullanılmaz ve gelir kaynağı olarak kullanılmaz.
- Sohbetler hiçbir koşulda otomatik olarak model eğitimine gönderilmez.
- Gizlilik iddiasının kanıtı olan çekirdek açık kaynaktır (AGPL-3.0); herkes tarafından incelenebilir, doğrulanabilir ve geliştirilebilir.

## 6. Güvenlik varsayılandır

Güvenlik hesap ve takiple değil, merkezi veri tutmamakla sağlanır. Saklanmayan veri çalınamaz.

- Sohbet geçmişi ve hafıza cihazda şifreli saklanır; isteğe bağlı biyometrik uygulama kilidi vardır.
- İndirilen her model SHA-256 ile doğrulanır. Model kataloğu uygulamaya gömülüdür.
- Web'den gelen metin her zaman bilgi olarak işlenir, asla talimat olarak işlenmez. Sayfalardaki kodlar çalıştırılmaz.
- Yalnızca güvenlik eğitimi almış sohbet modelleri katalogda yer alır.
- Bağımlılıklar az tutulur ve sürümleri sabitlenir; sürümler imzalanır.
- Güvenlik açıkları `SECURITY.md` üzerinden sorumlu şekilde bildirilir.

---

## Karar verirken sorulacak sorular

Yeni bir özellik veya değişiklik önerildiğinde:

1. Bu değişiklik kullanıcının herhangi bir verisini cihaz dışına çıkarıyor mu?
2. Bu değişiklik kullanıcı verisi tutan bir sunucuya ihtiyaç duyuyor mu?
3. Bu değişiklik kullanıcıdan hesap veya teknik bir ayar istiyor mu?
4. Bu değişiklik bir gizlilik veya güvenlik özelliğini ücretli hale getiriyor mu?
5. Bu değişiklik uygulamayı daha karmaşık hale getiriyor mu? Getiriyorsa, buna değer mi?

İlk dört sorudan birinin cevabı "evet" ise öneri bu haliyle kabul edilmez.
