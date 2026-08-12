
import prisma from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { ProjectAccess } from "../utils/projectAccess";
import { generateAIJson } from "./aiProvider.service";
import { createLogger } from '../utils/logger';

interface AIAnalysisResult {
    title: string;
    description: string;
    stepsToReproduce: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    confidence: number;
    reasoning: string;
}

const logger = createLogger('AutoBugReporterService');

export class AutoBugReporterService {


    static async analyzeFailure(userId: string, role: string, testResultId: string, language: string = 'en'): Promise<AIAnalysisResult> {
        // 1. Fetch Test Result & Context
        const testResult = await prisma.testResult.findUnique({
            where: { id: testResultId },
            include: {
                runItem: {
                    include: {
                        testCase: true
                    }
                }
            }
        });

        if (!testResult) throw new AppError("Test Result not found", 404);

        // Security Check
//         const projectId = testResult.runItem.testCase.suiteId; // Assuming suite -> project link needs lookup, or we can trust user access if they can see the result.
        // Actually, let's get project ID from testRunItem -> testRun -> project
        const runItem = await prisma.testRunItem.findUnique({
            where: { id: testResult.runItemId },
            include: { testRun: true }
        });

        if (runItem?.testRun.projectId) {
            await ProjectAccess.check(runItem.testRun.projectId, userId, role);
        }

        const logs = testResult.comment || "No logs available.";
        const testCaseTitle = testResult.runItem.testCase.title;

        const langInstruction = language === 'tr'
            ? 'IMPORTANT: You MUST write the Bug Report (title, description, steps, reasoning) in Turkish. Only JSON keys should remain in English.'
            : 'Write the Bug Report in English.';

        const prompt = `
            You are a QA Automation Expert. Analyze the following test failure and create a Bug Report.
            
            ${langInstruction}

            Test Case: ${testCaseTitle}
            Error: ${testResult.comment || "No specific error provided"}
            Logs: ${logs.substring(0, 1000)}

            Output JSON format:
            {
                "title": "Bug Title",
                "description": "Bug Description",
                "stepsToReproduce": "- Step 1\\n- Step 2",
                "severity": "HIGH",
                "confidence": 90,
                "reasoning": "Explanation"
            }
        `;

        try {
            const bugData = await generateAIJson<AIAnalysisResult>(prompt);
            return bugData;
        } catch (error) {
            logger.error('Auto-bug reporting failed:', error);
            throw new AppError("Failed to analyze failure with AI", 500);
        }
    }
}
