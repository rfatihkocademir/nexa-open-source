# Authorization Overview

This diagram provides a high-contrast, vivid visualization of the platform roles and their corresponding access levels.

```mermaid
graph LR
    %% Layout Configuration
    %% We use LR for better horizontal spread on wide screens

    %% Global Styles
    classDef category fill:#f0f4f8,stroke:#1a365d,stroke-width:2px,color:#1a365d,font-weight:bold
    classDef action fill:#fff,stroke:#cbd5e0,stroke-width:1px,color:#4a5568,font-size:11px

    %% Roles with High Contrast Colors
    ADMIN(("<div style='color:#fff;padding:10px;font-weight:bold'>ADMIN</div>"))
    TL(("<div style='color:#fff;padding:10px;font-weight:bold'>TEAM LEADER</div>"))
    TESTER(("<div style='color:#fff;padding:10px;font-weight:bold'>TESTER</div>"))
    JWT(("<div style='color:#fff;padding:10px;font-weight:bold'>AUTH USER</div>"))

    %% Role Styles
    style ADMIN fill:#C0392B,stroke:#641E16,stroke-width:4px
    style TL fill:#2980B9,stroke:#154360,stroke-width:3px
    style TESTER fill:#27AE60,stroke:#0E6251,stroke-width:3px
    style JWT fill:#7F8C8D,stroke:#2C3E50,stroke-width:2px,stroke-dasharray: 5 5

    %% Resource Categories (Horizontal Spacing)
    subgraph Management [Yönetim Katmanı]
        G_Global[Global Yönetim]:::category
        G_Project[Proje İşlemleri]:::category
    end

    subgraph Development [Geliştirme & Planlama]
        G_Backlog[Backlog & Agile]:::category
        G_AI[AI & Analiz]:::category
    end

    subgraph Quality [Kalite Güvencesi]
        G_Testing[Test & Koşu]:::category
        G_Evidence[Sonuç & Kanıt]:::category
    end

    subgraph Infrastructure [Altyapı]
        G_Infra[Ortamlar & Webhooks]:::category
    end

    %% Permissions Mapping with descriptive arrows
    ADMIN ==>|Tam Yetki| Management
    ADMIN ==>|Tam Yetki| Development
    ADMIN ==>|Tam Yetki| Quality
    ADMIN ==>|Tam Yetki| Infrastructure

    TL -- "Yönetim/Onay" --> G_Project
    TL -- "Planlama" --> G_Backlog
    TL -- "Analiz" --> G_AI
    TL -. "Kısıtlı" .-> G_Testing

    TESTER -- "Yürütme" --> G_Testing
    TESTER -- "Takip" --> G_Backlog
    TESTER -- "Rapor" --> G_Evidence

    JWT -. "Zayıf Erişim" .-> G_Infra
    JWT -. "Profil" .-> G_Global
```

## Rol ve Yetki Özeti

| Rol | Renk | Temel Sorumluluk |
| :--- | :--- | :--- |
| **ADMIN** | <span style="color:#D35400">Turuncu</span> | Tüm sistem, kullanıcı ve global ayarlar üzerinde tam kontrol. |
| **TEAM LEADER** | <span style="color:#2980B9">Mavi</span> | Proje yönetimi, üyelikler, release kararları ve AI analizleri. |
| **TESTER** | <span style="color:#27AE60">Yeşil</span> | Test süreçleri, senaryo yazımı, koşu yürütme ve hata takibi. |
| **AUTH USER** | <span style="color:#7F8C8D">Gri</span> | Temel profil işlemleri ve (şu anki zayıflıklar nedeniyle) sınırlı altyapı erişimi. |

> [!TIP]
> Metinlerin daha okunaklı olması için arka plan renkleri canlı (Vivid), yazı tipleri ise yüksek kontrastlı (Beyaz/Siyah) seçilmiştir.
