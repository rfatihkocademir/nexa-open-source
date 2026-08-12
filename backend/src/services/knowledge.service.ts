import prisma from '../utils/prisma';
import { generateAIEmbedding } from './aiProvider.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('KnowledgeService');

export type KnowledgeSearchHit = {
    entityId: string;
    entityType: string;
    similarity: number;
    content: string;
    [key: string]: unknown;
};

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length || a.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function chunkText(text: string, maxLength: number = 1000): string[] {
    if (!text) return [];
    const chunks = [];
    let current = '';
    const sentences = text.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
        if ((current.length + sentence.length) > maxLength && current.length > 0) {
            chunks.push(current.trim());
            current = '';
        }
        current += sentence + ' ';
    }
    if (current.trim().length > 0) {
        chunks.push(current.trim());
    }
    return chunks;
}

export class KnowledgeService {
    async indexEntity(projectId: string, entityType: string, entityId: string, content: string) {
        if (!content || content.trim() === '') return;
        
        try {
            const chunks = chunkText(content);
            
            // Remove old entries
            await prisma.projectKnowledge.deleteMany({
                where: { projectId, entityType, entityId }
            });

            for (const chunk of chunks) {
                const embedding = await generateAIEmbedding(chunk);
                await prisma.projectKnowledge.create({
                    data: {
                        projectId,
                        entityType,
                        entityId,
                        content: chunk,
                        embedding: embedding as any
                    }
                });
            }
            logger.info(`Indexed ${entityType}:${entityId} for project ${projectId}`);
        } catch (error) {
            logger.error(`Failed to index ${entityType}:${entityId}`, error);
        }
    }

    async getProjectKnowledgeCount(projectId: string): Promise<number> {
        return prisma.projectKnowledge.count({
            where: { projectId }
        });
    }

    async vectorSearch(projectId: string, query: string, limit: number = 8, threshold: number = 0.1): Promise<KnowledgeSearchHit[]> {
        try {
            const queryEmbedding = await generateAIEmbedding(query);
            
            // Fetch all knowledge for the project
            const knowledgeItems = await prisma.projectKnowledge.findMany({
                where: { projectId }
            });

            const results: KnowledgeSearchHit[] = [];

            for (const item of knowledgeItems) {
                if (!item.embedding) continue;
                const itemEmbedding = item.embedding as number[];
                const similarity = cosineSimilarity(queryEmbedding, itemEmbedding);
                
                if (similarity >= threshold) {
                    results.push({
                        entityId: item.entityId,
                        entityType: item.entityType,
                        similarity,
                        content: item.content
                    });
                }
            }

            // Sort by similarity descending
            results.sort((a, b) => b.similarity - a.similarity);
            
            if (results.length > 0) {
                logger.info(`Top match similarity for "${query}": ${results[0].similarity}`);
            } else {
                logger.info(`No matches found above threshold ${threshold} for "${query}"`);
                
                // Never feed unrelated project records to the assistant. Returning
                // arbitrary nearest records here can turn an unknown question into a
                // confident but factually wrong answer.
                return [];
            }
            
            return results.slice(0, limit);
        } catch (error) {
            logger.error(`Vector search failed for project ${projectId}`, error);
            return [];
        }
    }

    async syncProjectKnowledge(projectId: string) {
        logger.info(`Syncing project knowledge for project ${projectId}`);
        
        try {
            // 1. Wiki Pages
            const wikiSpaces = await prisma.wikiSpace.findMany({ where: { projectId }, select: { id: true } });
            const spaceIds = wikiSpaces.map(s => s.id);
            const pages = await prisma.wikiPage.findMany({
                where: { spaceId: { in: spaceIds }, deletedAt: null, status: 'APPROVED' },
            });

            await prisma.projectKnowledge.deleteMany({
                where: {
                    projectId,
                    entityType: 'WikiPage',
                    ...(pages.length > 0 ? { entityId: { notIn: pages.map((page) => page.id) } } : {}),
                },
            });
            
            for (const page of pages) {
                let contentStr = '';
                if (typeof page.content === 'string') contentStr = page.content;
                else if (page.content) contentStr = JSON.stringify(page.content);
                await this.indexEntity(projectId, 'WikiPage', page.id, `${page.title}\n\n${contentStr}`);
            }

            // 2. Work Items
            const workItems = await prisma.workItem.findMany({ where: { projectId, deletedAt: null } });
            await prisma.projectKnowledge.deleteMany({
                where: {
                    projectId,
                    entityType: 'WorkItem',
                    ...(workItems.length > 0 ? { entityId: { notIn: workItems.map((item) => item.id) } } : {}),
                },
            });
            for (const item of workItems) {
                const content = `${item.title}\n\n${item.description || ''}\n\nAcceptance Criteria: ${item.acceptanceCriteria || ''}`;
                await this.indexEntity(projectId, 'WorkItem', item.id, content);
            }

            // 3. Test Cases (using project relation from suite)
            const suites = await prisma.testSuite.findMany({ where: { projectId, deletedAt: null }, select: { id: true } });
            const suiteIds = suites.map(s => s.id);
            const testCases = await prisma.testCase.findMany({ where: { suiteId: { in: suiteIds }, deletedAt: null, status: 'APPROVED' } });
            await prisma.projectKnowledge.deleteMany({
                where: {
                    projectId,
                    entityType: 'TestCase',
                    ...(testCases.length > 0 ? { entityId: { notIn: testCases.map((testCase) => testCase.id) } } : {}),
                },
            });
            for (const tc of testCases) {
                const content = `${tc.title}\n\n${tc.description || ''}\n\nPreconditions: ${tc.preconditions || ''}`;
                await this.indexEntity(projectId, 'TestCase', tc.id, content);
            }

            // Requirements and comments are also written to project memory by their
            // own services. Reconcile them here as well so deletes/status changes do
            // not leave stale context behind.
            const requirements = await prisma.requirement.findMany({
                where: { projectId, deletedAt: null, status: 'APPROVED' },
            });
            await prisma.projectKnowledge.deleteMany({
                where: {
                    projectId,
                    entityType: 'Requirement',
                    ...(requirements.length > 0 ? { entityId: { notIn: requirements.map((item) => item.id) } } : {}),
                },
            });
            for (const requirement of requirements) {
                await this.indexEntity(projectId, 'Requirement', requirement.id, `${requirement.title}\n${requirement.description || ''}`);
            }

            const comments = await prisma.comment.findMany({
                where: { workItem: { projectId }, deletedAt: null },
            });
            await prisma.projectKnowledge.deleteMany({
                where: {
                    projectId,
                    entityType: 'Comment',
                    ...(comments.length > 0 ? { entityId: { notIn: comments.map((item) => item.id) } } : {}),
                },
            });
            for (const comment of comments) {
                await this.indexEntity(projectId, 'Comment', comment.id, comment.content);
            }
            
            logger.info(`Finished syncing project knowledge for project ${projectId}`);
        } catch (error) {
            logger.error(`Failed to sync project knowledge for project ${projectId}`, error);
        }
    }

    async removeEntity(entityType: string, entityId: string) {
        await prisma.projectKnowledge.deleteMany({
            where: { entityType, entityId }
        });
    }
}

export const knowledgeService = new KnowledgeService();
