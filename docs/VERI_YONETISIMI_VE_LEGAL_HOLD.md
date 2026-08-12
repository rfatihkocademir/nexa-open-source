# Veri Yönetişimi ve Legal Hold

Yönetim ekranı: **Yönetim → Kurumsal güvenlik → Legal hold**

## Legal hold ne zaman kullanılmalı?

Legal hold; dava, resmî inceleme, iç soruşturma, bağımsız denetim veya sözleşmesel kanıt koruma ihtiyacı oluştuğunda ilgili verilerin kalıcı olarak silinmesini engeller.

- **Kurum kapsamı:** Kurumdaki tüm projeleri korur.
- **Proje kapsamı:** Yalnızca seçilen proje ve o projenin alt kayıtlarını korur.

Aktif hold; proje, test case, work item ve wiki içeriğinin kalıcı silinmesini engeller. Soft-delete/arşivleme veriyi fiziksel olarak kaldırmadığı için günlük iş akışında kullanılabilir.

## Hold oluşturma

1. Kapsamı seçin.
2. Açıklayıcı bir başlık girin.
3. Dava, olay veya denetim referansını ekleyin.
4. En az 10 karakterlik somut gerekçe yazın.
5. Hold’u etkinleştirin.

Oluşturma işlemi aktör, zaman, kapsam, gerekçe ve referansla denetim zincirine yazılır.

## Hold kaldırma

Aktif hold sessizce silinemez. “Kontrollü kaldır” işlemi en az 10 karakterlik yeni bir gerekçe ister. Kaldıran kullanıcı, zaman ve gerekçe korunur; kayıt `RELEASED` durumuna geçer ve geçmişten silinmez.

## Saklama önizlemesi

Ekrandaki önizleme şunları gösterir:

- Kurumun denetim kaydı saklama süresi,
- Süresi dolmuş denetim kaydı sayısı,
- Soft-delete test case ve work item sayıları,
- Aktif hold sayısı,
- Temizleme değerlendirmesinin legal hold tarafından kilitlenip kilitlenmediği.

Güvenli varsayılan `PREVIEW_ONLY` modudur. Sistem bu aşamada otomatik kalıcı silme yapmaz. Üretim temizleme işi; yedekleme doğrulaması, onay akışı, legal hold kontrolü ve SIEM olayıyla birlikte ayrıca etkinleştirilmelidir.

## Operasyonel kontrol listesi

- Hold talebini yetkili hukuk/uyum sorumlusuyla doğrulayın.
- Kapsamı gereğinden dar seçmeyin.
- Referans numarasını kurumun olay/dava sistemiyle eşleştirin.
- Hold kaldırılmadan önce kanıt teslimini ve saklama yükümlülüğünün bittiğini doğrulayın.
- Kaldırma sonrasında denetim kaydını dış SIEM sisteminde kontrol edin.
