export type GlossaryKey = keyof typeof productGlossary;

export const productGlossary = {
    AI: { tr: ['Yapay zekâ', 'Verileri analiz eden, içerik öneren veya taslak oluşturan yardımcı yeteneklerdir. Son karar kullanıcıya aittir.'], en: ['Artificial intelligence', 'Assistant capabilities that analyze data, suggest content, or create drafts. The user remains responsible for the final decision.'] },
    API: { tr: ['Uygulama programlama arayüzü', 'Nexa ile başka sistemlerin kontrollü biçimde veri alıp vermesini sağlayan teknik arayüzdür.'], en: ['Application programming interface', 'A technical interface that lets Nexa and other systems exchange data in a controlled way.'] },
    EWMA: { tr: ['Üstel ağırlıklı hareketli ortalama', 'Yakın tarihli test koşumlarına daha fazla ağırlık vererek kalite seviyesinin güncel yönünü gösterir.'], en: ['Exponentially weighted moving average', 'Shows the current quality direction by giving more weight to recent test runs.'] },
    MFA: { tr: ['Çok faktörlü kimlik doğrulama', 'Parolanıza ek olarak doğrulama kodu kullanıp hesabı koruyan ikinci güvenlik katmanıdır.'], en: ['Multi-factor authentication', 'A second security layer that protects an account with a verification code in addition to a password.'] },
    OIDC: { tr: ['OpenID Connect', 'Kurumsal kimlik sağlayıcısıyla güvenli oturum açmayı standartlaştıran protokoldür.'], en: ['OpenID Connect', 'A protocol that standardizes secure sign-in through an enterprise identity provider.'] },
    QA: { tr: ['Kalite güvencesi', 'Ürünün belirlenen kalite koşullarını karşıladığını doğrulayan süreç ve sorumluluk alanıdır.'], en: ['Quality assurance', 'The process and responsibility area that verifies whether a product meets defined quality conditions.'] },
    RBAC: { tr: ['Rol tabanlı yetkilendirme', 'Kullanıcıların yapabileceği işlemleri proje rolü ve izinlerine göre sınırlar.'], en: ['Role-based access control', 'Restricts available actions according to a user\'s project role and permissions.'] },
    RTM: { tr: ['Gereksinim izlenebilirlik matrisi', 'Gereksinimlerin iş kayıtları, test case\'ler, koşumlar ve bug\'larla bağlantısını gösterir.'], en: ['Requirements traceability matrix', 'Shows how requirements connect to work items, test cases, runs, and bugs.'] },
    SLA: { tr: ['Hizmet seviyesi anlaşması', 'Bir hizmet veya kaydın hedef yanıt ve çözüm sürelerini tanımlar.'], en: ['Service-level agreement', 'Defines target response and resolution times for a service or record.'] },
    SSO: { tr: ['Tek oturum açma', 'Kurumsal hesabınızla ayrı bir Nexa şifresi kullanmadan giriş yapmanızı sağlar.'], en: ['Single sign-on', 'Lets you sign in with your enterprise account without a separate Nexa password.'] },
    WIP: { tr: ['Devam eden iş', 'Aynı anda aktif olarak çalışılan kayıt sayısıdır. WIP limiti ekipte aşırı iş birikmesini engeller.'], en: ['Work in progress', 'The number of records actively being worked on. A WIP limit prevents work from accumulating excessively.'] },
    TIER: { tr: ['Proje kalite seviyesi', 'Projenin risk ve kritiklik düzeyine göre test, pass güveni ve hata eşiklerini belirler. Tier 0 en sıkı seviyedir.'], en: ['Project quality level', 'Defines test, pass-confidence, and defect thresholds according to project criticality. Tier 0 is the strictest.'] },
    WILSON: { tr: ['Wilson güven aralığı', 'Pass oranını test sayısıyla birlikte yorumlar. Az sayıda testte görülen %100 sonucun aşırı güven vermesini engeller.'], en: ['Wilson confidence interval', 'Interprets pass rate together with sample size and prevents a 100% result from a small test set from appearing overly certain.'] },
    RELEASE: { tr: ['Release adayı', 'Canlıya alınması planlanan işleri, test kanıtlarını, kalite kararlarını ve paydaş onaylarını tek kapsamda toplar.'], en: ['Release candidate', 'Collects planned work, test evidence, quality decisions, and stakeholder approvals in one deployable scope.'] },
    TRACEABILITY: { tr: ['İzlenebilirlik', 'Bir ihtiyacın hangi işle geliştirildiğini, nasıl test edildiğini ve hangi hataların bulunduğunu uçtan uca gösterir.'], en: ['Traceability', 'Shows end to end which work implemented a need, how it was tested, and which defects were found.'] },
} as const;

export function glossaryText(key: GlossaryKey, language: string) {
    return productGlossary[key][language.startsWith('tr') ? 'tr' : 'en'];
}
