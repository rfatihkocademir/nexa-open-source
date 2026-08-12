# language: tr
@git @webhooks @matrix @p1
Özellik: Git (GitHub/GitLab) Webhook Entegrasyonları ve İzlenebilirlik
  Geliştiricilerin repository'lere (depolara) gönderdikleri kod değişiklikleri (Commit ve PR), sistemdeki iş öğeleriyle (WorkItem) otomatik ilişkilendirilmelidir.

  @s0 @commits
  Senaryo Taslağı: NEXA-UI-4801 - Commit mesajlarından WorkItem id'sinin çözümlenmesi (Parsing)
    Diyelim ki sisteme GitHub üzerinden bir "<webhook_payload>" mesajı ulaşmıştır
    Ne zaman Webhook Controller bu veriyi işlerse
    O zaman sistem "<hedef_workitem>" id'li iş öğesinin tarihçesine "<beklenen_commit>" kaydını ekler

    Örnekler:
      | webhook_payload                           | hedef_workitem | beklenen_commit                | aciklama               |
      | "fix(ui): resolved NEXA-123 login issue"  | NEXA-123       | "resolved NEXA-123 login issue"| Standart prefix eşleşmesi |
      | "Merge branch 'feature/NEXA-99-payment'"  | NEXA-99        | "Merge branch 'feature..."     | Branch isminden çıkarma |
      | "Update README.md"                        | (Hiçbiri)      | (Hiçbiri)                      | Eşleşmeyen commit       |

  @s1 @pr_sync
  Senaryo Taslağı: NEXA-UI-4802 - Pull Request (PR) durum değişikliklerinin yansıması
    Diyelim ki "NEXA-50" kodlu iş öğesine bağlı bir PR mevcuttur
    Ve PR GitHub üzerinde "<pr_yeni_durum>" durumuna geçmiştir
    O zaman Nexa sisteminde "NEXA-50" iş öğesinin durumu "<beklenen_statu>" olarak değişir

    Örnekler:
      | pr_yeni_durum | beklenen_statu | aciklama                       |
      | opened        | IN_REVIEW      | PR açıldığında incelemeye geçer|
      | merged        | READY_FOR_TEST | PR birleşince QA'e düşer       |
      | closed        | IN_PROGRESS    | Reddedilen PR geri döner       |
