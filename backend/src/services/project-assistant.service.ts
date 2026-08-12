import { knowledgeService } from './knowledge.service';
import { generateAIText } from './aiProvider.service';
import prisma from '../utils/prisma';
import { ProjectAccess } from '../utils/projectAccess';
import { createLogger } from '../utils/logger';
import { AppError } from '../utils/AppError';

const logger = createLogger('ProjectAssistantService');

type AssistantSource = {
    id: string;
    type: string;
    similarity: number;
    snippet: string;
    title: string;
    href: string;
};

export class ProjectAssistantService {
    private async ensureKnowledgeReady(projectId: string, userId: string, role: string) {
        // Entity mutations maintain their own index entries. A full reconciliation is
        // only needed for a project that has not been indexed yet; running it before
        // every chat made the local embedding model block the generation model.
        const indexedCount = await knowledgeService.getProjectKnowledgeCount(projectId);
        if (indexedCount === 0) {
            logger.info(`Project ${projectId} has no indexed knowledge; running initial synchronization.`);
            await knowledgeService.syncProjectKnowledge(projectId);
        }
    }

    private async buildSourceTitles(results: Array<{ entityType: string; entityId: string }>) {
        const wikiIds = results.filter((item) => item.entityType === 'WikiPage').map((item) => item.entityId);
        const workItemIds = results.filter((item) => item.entityType === 'WorkItem').map((item) => item.entityId);
        const testCaseIds = results.filter((item) => item.entityType === 'TestCase').map((item) => item.entityId);
        const commentIds = results.filter((item) => item.entityType === 'Comment').map((item) => item.entityId);
        const requirementIds = results.filter((item) => item.entityType === 'Requirement').map((item) => item.entityId);

        const [wikiPages, workItems, testCases, comments, requirements] = await Promise.all([
            wikiIds.length > 0
                ? prisma.wikiPage.findMany({ where: { id: { in: wikiIds } }, select: { id: true, title: true } })
                : Promise.resolve([]),
            workItemIds.length > 0
                ? prisma.workItem.findMany({ where: { id: { in: workItemIds } }, select: { id: true, title: true } })
                : Promise.resolve([]),
            testCaseIds.length > 0
                ? prisma.testCase.findMany({ where: { id: { in: testCaseIds } }, select: { id: true, title: true } })
                : Promise.resolve([]),
            commentIds.length > 0
                ? prisma.comment.findMany({ where: { id: { in: commentIds } }, select: { id: true, content: true } })
                : Promise.resolve([]),
            requirementIds.length > 0
                ? prisma.requirement.findMany({ where: { id: { in: requirementIds } }, select: { id: true, title: true } })
                : Promise.resolve([]),
        ]);

        const titleMap = new Map<string, string>();

        for (const page of wikiPages) titleMap.set(`WikiPage:${page.id}`, page.title);
        for (const item of workItems) titleMap.set(`WorkItem:${item.id}`, item.title);
        for (const testCase of testCases) titleMap.set(`TestCase:${testCase.id}`, testCase.title);
        for (const comment of comments) titleMap.set(`Comment:${comment.id}`, comment.content.slice(0, 80));
        for (const requirement of requirements) titleMap.set(`Requirement:${requirement.id}`, requirement.title);

        return titleMap;
    }

    private formatContext(results: any[], titleMap: Map<string, string>) {
        return results.map((res: any, index: number) => {
            const key = `${res.entityType}:${res.entityId}`;
            const title = titleMap.get(key) || `${res.entityType} ${res.entityId}`;
            return [
                `SOURCE ${index + 1}`,
                `Type: ${res.entityType}`,
                `Id: ${res.entityId}`,
                `Title: ${title}`,
                `Similarity: ${Math.round(Number(res.similarity) * 100)}%`,
                `Content: ${res.content}`,
            ].join('\n');
        }).join('\n---\n');
    }

    private buildFallbackResponse(projectName: string, hasKnowledge: boolean) {
        if (hasKnowledge) {
            return `Bu soruyu mevcut proje hafızasına dayanarak güvenilir şekilde cevaplayamıyorum. Daha net bir ifade deneyin veya ilgili wiki/stories/test kayıtlarının bu projede bulunduğunu doğrulayın.\n\nKaynaklar: bulunamadı.`;
        }

        return `${projectName} projesi için henüz indekslenmiş bir proje hafızası bulamadım. Bu yüzden kaynağa dayalı cevap veremiyorum.\n\nKaynaklar: bulunamadı.`;
    }

    private buildSourceHref(projectId: string, entityType: string, entityId: string) {
        switch (entityType) {
            case 'WikiPage':
                return `/projects/${projectId}?tab=wiki&pageId=${entityId}`;
            case 'WorkItem':
                return `/projects/${projectId}?tab=backlog&workItemId=${entityId}`;
            case 'TestCase':
                return `/projects/${projectId}?tab=test-cases&testCaseId=${entityId}`;
            default:
                return `/projects/${projectId}?tab=project-memory`;
        }
    }

    /**
     * Orchestrates the RAG (Retrieval-Augmented Generation) flow for the Project Assistant.
     */
    async chat(projectId: string, userId: string, role: string, messages: { role: string; content: string }[]) {
        await ProjectAccess.check(projectId, userId, role);

        const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

        if (!lastUserMessage) {
            throw new AppError('No user message found to process.', 400);
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, name: true, description: true },
        });

        if (!project) {
            throw new AppError('Project not found.', 404);
        }

        await this.ensureKnowledgeReady(projectId, userId, role);

        // 1. Retrieve relevant context from project memory (vector store)
        const contextResults = await knowledgeService.vectorSearch(projectId, lastUserMessage, 8, 0.4);
        const titleMap = await this.buildSourceTitles(contextResults);
        const contextStrings = this.formatContext(contextResults, titleMap);

        if (contextResults.length === 0) {
            return {
                content: this.buildFallbackResponse(project.name, (await knowledgeService.getProjectKnowledgeCount(projectId)) > 0),
                sources: [] as AssistantSource[],
            };
        }

        // 2. Build the prompt
        const historyContext = messages.slice(-5).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        const systemPrompt = `
You are the "Project Assistant" for the project named "${project.name}".
Project description: "${project.description || 'No description provided.'}"

Your goal is to answer the user's question using ONLY the project memory provided below.
Do not answer about the Nexa product itself unless the retrieved project memory explicitly contains that information.

PROJECT MEMORY CONTEXT:
${contextStrings}

CONVERSATION HISTORY:
${historyContext}

USER QUESTION:
${lastUserMessage}

STRICT INSTRUCTIONS:
1. Use the provided PROJECT MEMORY CONTEXT to answer the user's question.
2. If the information is not in the context, clearly state that you don't know based on the current project memory. NEVER hallucinate information outside the context.
3. ALWAYS cite every factual claim using the format [EntityType:EntityId] (e.g., [WikiPage:123], [WorkItem:456]).
4. If you cannot cite a claim, do not make that claim.
5. Structure your response clearly. If different types of information are found, categorize them under sections like "Dokümanlar" (Documents), "Tartışmalar" (Discussions), or "Testler" (Tests).
6. The tone should be professional, insightful, and premium.
7. Write your response in the SAME LANGUAGE as the user's question (Turkish if Turkish, English if English).

Response Format:
- Start with a direct answer.
- Followed by categorized details if necessary.
- End with a summary of sources cited.
`;

        try {
            const responseText = await generateAIText(systemPrompt);
            
            return {
                content: responseText,
                sources: contextResults.map((res: any) => ({
                    id: res.entityId,
                    type: res.entityType,
                    similarity: res.similarity,
                    snippet: `${(titleMap.get(`${res.entityType}:${res.entityId}`) || '').trim()}\n${res.content.substring(0, 200)}`.trim(),
                    title: titleMap.get(`${res.entityType}:${res.entityId}`) || `${res.entityType} ${res.entityId}`,
                    href: this.buildSourceHref(projectId, res.entityType, res.entityId),
                })) as AssistantSource[],
            };
        } catch (error) {
            logger.error('Project assistant chat error:', error);
            throw new AppError('AI provider failed to generate a response for the project assistant.', 502);
        }
    }
}

export const projectAssistantService = new ProjectAssistantService();
