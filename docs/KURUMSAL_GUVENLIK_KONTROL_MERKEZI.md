# Kurumsal Güvenlik Kontrol Merkezi

Yönetim ekranı: **Yönetim → Kurumsal güvenlik** (`/admin/security`)

## Devreye alma sırası

1. Kurumsal OIDC sağlayıcısını oluşturun ve test kullanıcılarıyla giriş doğrulaması yapın.
2. Kullanıcıların MFA kurulumlarını tamamlamasını sağlayın.
3. İzin verilen IP/CIDR listesini girin. Sistem, yöneticinin mevcut IP adresi listede değilse kaydı reddederek kendini kilitlemesini önler.
4. Boşta kalma ve azami oturum sürelerini kurum politikanıza göre belirleyin.
5. SSO ve MFA zorunluluğunu etkinleştirin.

Politika değişikliği sonrasında tüm aktif kurum oturumları güvenlik amacıyla sonlandırılır. Kullanıcıların yeniden giriş yapması gerekir.

## Proje veri sınıfları

- **Herkese açık:** Kurum dışıyla paylaşılabilecek içerik.
- **Kurum içi:** Varsayılan kurum içi çalışma verisi.
- **Gizli:** İş ihtiyacı olan ekiplerle sınırlandırılması gereken veri.
- **Kısıtlı:** En hassas veri sınıfı. “Yöneticiden açık üyelik iste” kuralıyla birlikte kullanılmalıdır.

Kısıtlı ve açık üyelik zorunlu bir projede `ADMIN` rolü tek başına erişim sağlamaz. Yönetici de proje üyesi olmalıdır. Kural; proje, task, yorum, test case, test sonucu, test koşumu, wiki, ortam ve ek dosya erişim yollarında merkezi olarak uygulanır.

## Güvenli ağ tanımları

Tek IP (`203.0.113.10`), IPv4 CIDR (`10.0.0.0/8`) ve IPv6 CIDR (`2001:db8::/32`) desteklenir. Liste boşsa IP kısıtı uygulanmaz.

Reverse proxy kullanılıyorsa yalnızca güvenilen proxy katmanının `X-Forwarded-For` başlığını yazabildiği ve Express `trust proxy` ayarının altyapıyla uyumlu olduğu doğrulanmalıdır.

## Acil erişim prosedürü

Yanlış SSO veya ağ politikası nedeniyle erişim kesilirse değişiklik doğrudan veritabanından sessizce kaldırılmamalıdır. Yetkili iki kişiyle olay kaydı açın, değişiklik öncesi/sonrası kanıtını saklayın ve `OrganizationSecurityPolicy` kaydını kontrollü olarak düzeltin. Ardından tüm kurum oturumlarını iptal edin ve denetim kaydını olay numarasıyla ilişkilendirin.
