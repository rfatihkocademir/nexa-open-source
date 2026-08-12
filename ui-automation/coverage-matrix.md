# Kapsam Matrisi

BDD cümlelerinin tamamını yerel bir katalogda görmek için `npm run bdd:catalog` komutunu bu dizinde çalıştırın.

| Alan | Feature Dosyası | Spec Dosyası | Çalışma Modu |
| --- | --- | --- | --- |
| Giriş ve yetkilendirme | `features/auth.feature` | `tests/specs/auth.spec.ts` | Canlı + Mock |
| Dashboard | `features/dashboard.feature` | `tests/specs/dashboard.spec.ts` | Canlı + Mock |
| Projeler | `features/projects.feature` | `tests/specs/projects.spec.ts` | Canlı + Mock |
| Proje detayları | `features/project-details.feature` | `tests/specs/project-details.spec.ts` | Mock |
| Proje oluşturma sihirbazı | `features/project-wizard.feature` | `tests/specs/project-wizard.spec.ts` | Mock |
| Test koşuları | `features/runs.feature` | `tests/specs/runs.spec.ts` | Canlı + Mock |
| Raporlar | `features/reports.feature` | `tests/specs/reports.spec.ts` | Canlı + Mock |
| Profil | `features/profile.feature` | `tests/specs/profile.spec.ts` | Canlı + Mock |
| Yetki reddi | `features/accessibility-and-negative.feature` | `tests/specs/forbidden.spec.ts` | Canlı + Mock |
| Erişilebilirlik kontrolleri | `features/accessibility-and-negative.feature` | `tests/specs/accessibility.spec.ts` | Canlı + Mock |
| P0 kimlik, oturum ve yetki hata avı | `features/p0-auth-rbac.feature` | Planlanan P0 spec kapsamı | Mock + Live smoke |
| P0 proje, dashboard ve sihirbaz hata avı | `features/p0-projects-wizard.feature` | Planlanan P0 spec kapsamı | Mock |
| P0 test tasarımı ve otomasyon kurucu hata avı | `features/p0-test-design-automation.feature` | Planlanan P0 spec kapsamı | Mock |
| P0 test koşusu, sonuç, rapor ve release hata avı | `features/p0-runs-results-reports.feature` | Planlanan P0 spec kapsamı | Mock |
| P0 admin, wiki, dayanıklılık ve erişilebilirlik hata avı | `features/p0-admin-wiki-resilience.feature` | Planlanan P0 spec kapsamı | Mock + Live smoke |

## Notlar

- Türkçe feature dosyaları kullanıcı odaklı kabul kriterlerini taşır.
- Playwright spec dosyaları aynı senaryoların çalışan karşılığını içerir.
- Canlı mod, backend hazır olduğunda gerçek hata bulmak için kullanılır.
- Mock mod, hızlı ve deterministik regresyon için kullanılır.
- 5000 senaryo hedefi [5000-scenario-plan.md](./5000-scenario-plan.md) içinde risk bazlı, elle kürate edilen paketlerle yönetilir.
