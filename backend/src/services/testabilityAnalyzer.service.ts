import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

export interface TestabilityAnalysisResult {
    requirementId: string;
    testabilityScore: number; // 0-100
    status: 'EXCELLENT' | 'ADEQUATE' | 'NEEDS_IMPROVEMENT' | 'POOR';
    hasAcceptanceCriteria: boolean;
    givenWhenThenFormat: boolean;
    edgeCasesDefined: boolean;
    missingElements: string[];
    recommendations: string[];
}

export class TestabilityAnalyzerService {
    analyzeContent(title: string, description: string = ''): Omit<TestabilityAnalysisResult, 'requirementId'> {
        const text = `${title} ${description}`.toLowerCase();

        let score = 50; // base score
        const missingElements: string[] = [];
        const recommendations: string[] = [];

        // 1. Acceptance Criteria check
        const hasAcceptanceCriteria = text.includes('kabul kriter') || text.includes('acceptance criteria') || text.includes('kriter') || text.includes('koşul');
        if (hasAcceptanceCriteria) {
            score += 15;
        } else {
            missingElements.push('Kabul Kriterleri (Acceptance Criteria) tanımlanmamış.');
            recommendations.push('Gereksinime net "Kabul Kriterleri" maddeleri ekleyin.');
        }

        // 2. Given-When-Then or Scenario format check
        const givenWhenThenFormat = (text.includes('given') || text.includes('verildiğinde') || text.includes('varsayalım')) &&
            (text.includes('when') || text.includes('olduğunda') || text.includes('yapıldığında')) &&
            (text.includes('then') || text.includes('olmalı') || text.includes('beklenir'));
        if (givenWhenThenFormat) {
            score += 20;
        } else {
            missingElements.push('Gherkin / Given-When-Then senaryo yapısı bulunamadı.');
            recommendations.push('Test senaryolarının kolay üretilebilmesi için "Verildiğinde -> Olduğunda -> Beklenir" formatını kullanın.');
        }

        // 3. Edge Cases / Error Handling check
        const edgeCasesDefined = text.includes('hata') || text.includes('error') || text.includes('invalid') || text.includes('geçersiz') || text.includes('sınır') || text.includes('exception');
        if (edgeCasesDefined) {
            score += 15;
        } else {
            missingElements.push('Hata / Sınır Durumları (Edge Cases) belirtilmemiş.');
            recommendations.push('Geçersiz veri, yetki hatası veya zaman aşımı gibi sınır durumlarını tanımlayın.');
        }

        // Length & Detail Check
        if (description.length < 50) {
            score -= 10;
            missingElements.push('Gereksinim açıklaması çok kısa veya yetersiz.');
            recommendations.push('Gereksinimi detaylandırarak en az 2-3 cümlelik açıklama sağlayın.');
        } else if (description.length > 200) {
            score += 5;
        }

        const finalScore = Math.max(0, Math.min(100, score));

        let status: TestabilityAnalysisResult['status'] = 'POOR';
        if (finalScore >= 85) status = 'EXCELLENT';
        else if (finalScore >= 70) status = 'ADEQUATE';
        else if (finalScore >= 50) status = 'NEEDS_IMPROVEMENT';

        return {
            testabilityScore: finalScore,
            status,
            hasAcceptanceCriteria,
            givenWhenThenFormat,
            edgeCasesDefined,
            missingElements,
            recommendations
        };
    }

    async analyzeRequirement(requirementId: string): Promise<TestabilityAnalysisResult> {
        const req = await prisma.requirement.findUnique({
            where: { id: requirementId }
        });

        if (!req) {
            throw new AppError('Requirement not found', 404);
        }

        const analysis = this.analyzeContent(req.title, req.description || '');

        return {
            requirementId,
            ...analysis
        };
    }
}

export const testabilityAnalyzerService = new TestabilityAnalyzerService();
