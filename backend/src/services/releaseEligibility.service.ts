import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { promptService } from './prompt.service';
import { generateAIJson } from './aiProvider.service';

export interface EligibilityReport {
    candidateId: string;
    isEligible: boolean;
    readinessScore: number;
    blockers: string[];
    warnings: string[];
    details: {
        criticalBugs: number;
        coverage: number;
        failedRuns: number;
        openFollowUps: number;
        traceabilityGaps: number;
        aiRiskScore?: number;
        aiAssessment?: string;
        aiRecommendation?: string;
    };
}

export class ReleaseEligibilityService {
    async evaluate(candidateId: string, expectedProjectId?: string): Promise<EligibilityReport> {
        const candidate = await prisma.releaseCandidate.findFirst({
            where: {
                id: candidateId,
                ...(expectedProjectId ? { projectId: expectedProjectId } : {}),
            },
            include: {
                runLinks: { include: { testRun: true } },
                workItemLinks: { include: { workItem: true } },
                followUps: { include: { workItem: true } }
            }
        });

        if (!candidate) {
            throw new AppError('Release candidate not found', 404);
        }

        const blockers: string[] = [];
        const warnings: string[] = [];

        // 1. Critical Bugs Rule
        const criticalBugs = candidate.criticalOpenBugs;
        if (criticalBugs > 0) {
            blockers.push(`Release blocked: ${criticalBugs} critical bug(s) still open.`);
        }

        // 2. Test Coverage Rule
        const coverage = candidate.totalTestCases > 0 
            ? candidate.approvedTestCases / candidate.totalTestCases 
            : 0;
        
        if (coverage < 0.7) {
            blockers.push(`Insufficient test coverage: ${(coverage * 100).toFixed(1)}% (minimum 70% required).`);
        } else if (coverage < 0.9) {
            warnings.push(`Test coverage is ${(coverage * 100).toFixed(1)}%. Consider increasing coverage before final release.`);
        }

        // 3. Test Execution Rule
        const failedItems = candidate.failedRunItems + candidate.blockedRunItems;
        if (failedItems > 0) {
            blockers.push(`Failed/Blocked tests detected: ${failedItems} items must be resolved.`);
        }

        if (candidate.openRuns > 0) {
            blockers.push(`${candidate.openRuns} test runs are still in progress.`);
        }

        // 4. Traceability Rule
        if (candidate.traceabilityGaps > 0) {
            blockers.push(`${candidate.traceabilityGaps} stories lack linked test cases.`);
        }

        // 5. Follow-up Rule
        const openFollowUps = candidate.followUps.filter(f => 
            f.workItem.status !== 'DONE' && f.workItem.status !== 'CLOSED'
        ).length;
        if (openFollowUps > 0) {
            blockers.push(`${openFollowUps} release follow-up items are still pending.`);
        }

        // 7. Qualitative AI Risk Analysis
        let aiRisk: any = null;
        try {
            const workItemsData = candidate.workItemLinks.map(l => `- [${l.workItem.itemType}] ${l.workItem.title}: ${l.workItem.status}`).join('\n');
            const failuresData = candidate.runLinks.map(l => `- Run ${l.testRunId}: ${l.testRun.status}`).join('\n');

            const riskPrompt = await promptService.renderPrompt('release-risk-analyzer', {
                title: candidate.title,
                summary: candidate.summary || 'No summary',
                workItems: workItemsData,
                bugs: failuresData
            });

            aiRisk = await generateAIJson<any>(riskPrompt);
            
            if (aiRisk.recommendation === 'NO-GO') {
                blockers.push(`AI Risk Assessment: NO-GO. ${aiRisk.assessment}`);
            } else if (aiRisk.recommendation === 'CAUTION') {
                warnings.push(`AI Risk Assessment Caution: ${aiRisk.assessment}`);
            }
        } catch (error) {
            console.error('AI Risk Analysis failed', error);
            warnings.push('Qualitative AI risk assessment was skipped due to a service error.');
        }

        // Calculation of Readiness Score (0-100)
        let score = 100;
        score -= (criticalBugs * 20);
        score -= (failedItems * 5);
        score -= (candidate.traceabilityGaps * 10);
        score -= (openFollowUps * 5);
        if (coverage < 1) score -= (1 - coverage) * 30;
        if (aiRisk) score -= (aiRisk.riskScore / 2); // Weigh AI risk as 50% impact on score

        const finalScore = Math.max(0, Math.min(100, score));

        return {
            candidateId,
            isEligible: blockers.length === 0,
            readinessScore: finalScore,
            blockers,
            warnings,
            details: {
                criticalBugs,
                coverage,
                failedRuns: failedItems,
                openFollowUps,
                traceabilityGaps: candidate.traceabilityGaps,
                aiRiskScore: aiRisk?.riskScore,
                aiAssessment: aiRisk?.assessment,
                aiRecommendation: aiRisk?.recommendation
            }
        };
    }
}

export const releaseEligibilityService = new ReleaseEligibilityService();
