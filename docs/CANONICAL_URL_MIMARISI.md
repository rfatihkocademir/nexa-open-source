# Canonical URL Mimarisi

Nexa on-premise kurulumlarında alan adı kurumu temsil eder. Bu nedenle URL içinde kurum kimliği veya veritabanı UUID'si taşınmaz.

## Canonical biçim

Proje çalışma alanı:

```text
/{ekip-slug}/{proje-slug}
/{ekip-slug}/{proje-slug}/{bolum}
```

Kayıt detayı:

```text
/{ekip-slug}/{proje-slug}/{kaynak-turu}/{kaynak-key}/{opsiyonel-baslik-slug}
```

Örnekler:

```text
/core/payments/board
/core/payments/task/PAY-142
/core/payments/bug/PAY-BUG-38
/core/payments/test/PAY-TC-92
/core/payments/run/PAY-TR-24
/core/payments/release/PAY-RC-8
/core/payments/wiki/PAY-DOC-17/odeme-mimarisi
```

## Temel kurallar

- UUID yalnızca veritabanı ilişkilerinde ve iç API işlemlerinde kullanılır.
- Kullanıcıya gösterilen ve paylaşılan adresler key tabanlıdır.
- Kaynak türü backend tarafından gerçek kayıttan belirlenir; URL'deki yanlış tür canonical adrese yönlendirilir.
- Wiki sayfası başlığı değişebilir. Çözümleme değişmez `PROJE-DOC-n` key'iyle yapılır; başlık slug'ı yalnızca okunabilirlik sağlar.
- Ekip değişirse eski adres alias olarak saklanır ve yeni canonical adrese yönlendirilir.
- Eski `/p/:projectKey`, `/b/:resourceKey`, `/browse/:key` ve `/projects/:uuid` adresleri geriye uyumluluk içindir; tarayıcı adresi canonical biçime çevrilir.
- Birincil ekibi olmayan eski projeler geçici olarak `workspace` ekip segmentini kullanır. Proje ayarlarından ekip seçildiğinde adres gerçek ekip slug'ına taşınır.

## Güvenlik

- Kaynak çözümleme işleminden önce kullanıcı oturumu doğrulanır.
- Proje erişimi canonical adres üretilmeden önce kontrol edilir.
- URL'ye müşteri adı, kişisel veri, açıklama veya gizli sistem bilgisi yazılmaz.
- Olmayan ve erişilemeyen kaynaklar kurumun bilgi sızdırma politikasına uygun genel hata yanıtı üretir.
