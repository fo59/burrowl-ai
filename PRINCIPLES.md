# Local AI Mobile — Temel Prensipler

Bu belge projenin anayasasıdır. Her özellik, her kod değişikliği ve her tasarım kararı bu prensiplere uymak zorundadır. Bir prensiple çelişen bir öneri, ne kadar faydalı görünürse görünsün kabul edilmez.

---

## 1. Sunucu yok

Projenin hiçbir sunucusu yoktur ve olmayacaktır.

- Kullanıcı verisi toplayan, saklayan veya işleyen hiçbir merkezi sistem kurulmaz.
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

## 4. Sıfır kurulum

Uygulama teknik bilgi gerektirmez.

- Hesap yok.
- API anahtarı yok.
- Sunucu adresi veya teknik ayar yok.
- Kullanıcı uygulamayı indirir, önerilen modeli indirir ve kullanmaya başlar.

## 5. Abonelik yok

Uygulama ücretsizdir ve açık kaynaktır.

- Ücretli özellik, abonelik veya reklam yoktur.
- Kaynak kodu herkes tarafından incelenebilir, doğrulanabilir ve geliştirilebilir.

## 6. Güvenlik varsayılandır

Güvenlik hesap ve takiple değil, merkezi veri tutmamakla sağlanır. Saklanmayan veri çalınamaz.

- Sohbet geçmişi ve hafıza cihazda şifreli saklanır; isteğe bağlı biyometrik uygulama kilidi vardır.
- İndirilen her model SHA-256 ile doğrulanır.
- Web'den gelen metin her zaman bilgi olarak işlenir, asla talimat olarak işlenmez. Sayfalardaki kodlar çalıştırılmaz.
- Yalnızca güvenlik eğitimi almış sohbet modelleri katalogda yer alır.
- Bağımlılıklar az tutulur ve sürümleri sabitlenir; sürümler imzalanır.
- Güvenlik açıkları `SECURITY.md` üzerinden sorumlu şekilde bildirilir.

---

## Karar verirken sorulacak sorular

Yeni bir özellik veya değişiklik önerildiğinde:

1. Bu değişiklik kullanıcının herhangi bir verisini cihaz dışına çıkarıyor mu?
2. Bu değişiklik bir sunucuya ihtiyaç duyuyor mu?
3. Bu değişiklik kullanıcıdan teknik bir ayar veya hesap istiyor mu?
4. Bu değişiklik uygulamayı daha karmaşık hale getiriyor mu? Getiriyorsa, buna değer mi?

İlk üç sorudan birinin cevabı "evet" ise öneri bu haliyle kabul edilmez.
