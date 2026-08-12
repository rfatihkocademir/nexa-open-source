import prisma from '../utils/prisma';
// import { AppError } from '../utils/AppError';

interface ExtractedRef {
    action: string;
    workItemId: string;
}

export class GitWebhookService {

    /**
     * Parse commit message to extract issue references like "Fixes TS-12"
     */
    extractReferences(message: string): ExtractedRef[] {
        const regex = /(?:fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved|relates to) ([A-Za-z0-9]+-\d+)/gi;
        const refs: ExtractedRef[] = [];
        let match;

        while ((match = regex.exec(message)) !== null) {
            refs.push({
                action: match[0].split(' ')[0].toLowerCase(), // e.g., "fixes"
                workItemId: match[1] // The issue ID (Needs project prefix validation but we will search)
            });
        }

        return refs;
    }

    /**
     * Finds the internal UUID of a WorkItem by its human-readable tag (e.g. TS-123)
     * For now, we search by title prefix "TS-123" if a structured tag system is missing, or
     * we will attempt to find matching workitems.
     */
    async findWorkItemByTag(projectId: string, tag: string) {
        // As a fallback for MVP V2, Nexa doesn't have an autoincrement TS-123 ticket ID yet natively.
        // We will assume `title` starts with the tag, OR we search by some specific rule.
        // Let's implement a dummy fallback for MVP.
        const workItems = await prisma.workItem.findMany({
            where: {
                projectId,
                title: { startsWith: tag } // E.g., title: "TS-12 Login page bug"
            },
            take: 1
        });

        return workItems[0] || null;
    }

    /**
     * Handle incoming GitHub push event
     */
    async handlePush(projectId: string, payload: any) {
        if (!payload.commits || !Array.isArray(payload.commits)) return;

        for (const commit of payload.commits) {
            const extractedRefs = this.extractReferences(commit.message);

            for (const ref of extractedRefs) {
                // Find associated WorkItem
                const workItem = await this.findWorkItemByTag(projectId, ref.workItemId);

                if (workItem) {
                    await prisma.gitCommit.create({
                        data: {
                            hash: commit.id,
                            message: commit.message,
                            authorName: commit.author?.name || 'Unknown',
                            authorEmail: commit.author?.email || 'unknown@example.com',
                            url: commit.url,
                            date: new Date(commit.timestamp),
                            projectId,
                            workItemId: workItem.id
                        }
                    });

                    // Update WorkItem Status if action implies closure/resolve
                    const closureWords = ['fix', 'fixes', 'fixed', 'close', 'closes', 'closed', 'resolve', 'resolves', 'resolved'];
                    if (closureWords.includes(ref.action)) {
                        // Move to "DONE" or "REVIEW"
                        // Requires checking if BoardColumn named "Done" exists
                        const doneCol = await prisma.boardColumn.findFirst({
                            where: { projectId, name: { in: ['Done', 'DONE', 'Closed', 'Resolved'] } }
                        });

                        const updateData: any = { status: 'DONE' };
                        if (doneCol) updateData.boardColumnId = doneCol.id;

                        await prisma.workItem.update({
                            where: { id: workItem.id },
                            data: updateData
                        });
                    }
                }
            }
        }
    }

    /**
     * Handle incoming GitHub Pull Request event
     */
    async handlePullRequest(projectId: string, payload: any) {
        if (!payload.pull_request) return;

        const pr = payload.pull_request;
        const msg = pr.title + ' ' + (pr.body || '');
        const extractedRefs = this.extractReferences(msg);

        const isMerged = pr.merged;
        const state = pr.state; // 'open' or 'closed'

        for (const ref of extractedRefs) {
            const workItem = await this.findWorkItemByTag(projectId, ref.workItemId);

            if (workItem) {
                await prisma.pullRequest.upsert({
                    where: {
                        projectId_prNumber: { projectId, prNumber: pr.number }
                    },
                    update: {
                        title: pr.title,
                        state,
                        mergedAt: isMerged ? new Date(pr.merged_at) : null,
                        url: pr.html_url,
                        workItemId: workItem.id
                    },
                    create: {
                        prNumber: pr.number,
                        title: pr.title,
                        state,
                        url: pr.html_url,
                        author: pr.user?.login || 'Unknown',
                        mergedAt: isMerged ? new Date(pr.merged_at) : null,
                        projectId,
                        workItemId: workItem.id
                    }
                });
            }
        }
    }
}

export const gitWebhookService = new GitWebhookService();
