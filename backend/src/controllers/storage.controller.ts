import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import {
    saveAttachment,
    getAttachmentStream,
    deleteAttachment,
    assertAttachmentAccess,
    assertAttachmentTargetAccess,
    getAttachmentsByWorkItem,
    getAttachmentsByComment,
    getAttachmentsByTestResult,
    getAttachmentsByTestCase,
    getAttachmentsByWikiPage,
} from '../services/storage.service';
import { ProjectAccess } from '../utils/projectAccess';
import { AppError } from '../utils/AppError';
import { STORAGE_PREFIX, type StoragePrefix } from '../services/minio.service';
import { getRequestActor } from '../utils/requestContext';
import { createLogger } from '../utils/logger';

const logger = createLogger('StorageController');

const respondWithError = (res: Response, error: unknown) => {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return res.status(statusCode).json({ status: 'error', message });
};

export const storageController = {
    /**
     * Upload a file → MinIO + DB metadata
     */
    uploadFile: async (req: Request, res: Response) => {
        try {
            const { userId, role } = getRequestActor(req);
            if (!req.file) {
                return res.status(400).json({ status: 'error', message: 'No file provided' });
            }

            const { buffer, originalname, mimetype, size } = req.file;
            let { workItemId, commentId, testResultId, testCaseId, wikiPageId, category } = req.body;

            if (workItemId) {
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workItemId);
                if (!isUUID) {
                    const resolved = await prisma.workItem.findFirst({
                        where: { key: workItemId, deletedAt: null },
                        select: { id: true }
                    });
                    if (!resolved) {
                        throw new AppError('Work item not found', 404);
                    }
                    workItemId = resolved.id;
                }
            }

            await assertAttachmentTargetAccess(
                { workItemId, commentId, testResultId, testCaseId, wikiPageId, category },
                { userId, role }
            );

            // Determine storage prefix based on context
            let prefix: StoragePrefix = STORAGE_PREFIX.WORK_ITEM;
            if (testResultId) prefix = STORAGE_PREFIX.EVIDENCE;
            else if (testCaseId) prefix = STORAGE_PREFIX.STEP_IMAGE;
            else if (wikiPageId) prefix = STORAGE_PREFIX.WIKI;
            else if (commentId) prefix = STORAGE_PREFIX.COMMENT;

            const attachment = await saveAttachment(
                buffer,
                originalname,
                mimetype,
                size,
                userId,
                { workItemId, commentId, testResultId, testCaseId, wikiPageId, category, prefix }
            );

            return res.status(201).json({
                status: 'success',
                data: {
                    id: attachment.id,
                    filename: attachment.filename,
                    mimetype: attachment.mimetype,
                    size: attachment.size,
                    url: `/api/v1/storage/attachments/${attachment.id}`,
                },
            });
        } catch (error: any) {
            logger.error('Upload error:', error);
            return respondWithError(res, error);
        }
    },

    /**
     * Stream an authorized attachment without exposing MinIO publicly.
     */
    serveAttachment: async (req: Request, res: Response) => {
        try {
            const { userId, role } = getRequestActor(req);
            const { id } = req.params;
            await assertAttachmentAccess(id, { userId, role });
            const attachment = await getAttachmentStream(id);

            if (!attachment) {
                return res.status(404).json({ status: 'error', message: 'Attachment not found' });
            }

            const safeFilename = attachment.filename.replace(/[\r\n"]/g, '_');
            res.setHeader('Content-Type', attachment.mimetype);
            res.setHeader('Content-Length', String(attachment.size));
            res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
            res.setHeader('Cache-Control', 'private, max-age=300');
            attachment.stream.on('error', (streamError) => {
                logger.error('Attachment stream failed:', streamError);
                if (!res.headersSent) res.status(502).end();
                else res.destroy(streamError);
            });
            return attachment.stream.pipe(res);
        } catch (error: any) {
            if (error?.statusCode !== 404) {
                logger.error('Serve attachment error:', error);
            } else {
                logger.warn(`Serve attachment 404: ${req.params.id}`);
            }
            return respondWithError(res, error);
        }
    },

    /**
     * Delete an attachment from MinIO + DB
     */
    deleteFile: async (req: Request, res: Response) => {
        try {
            const { userId, role } = getRequestActor(req);
            const { id } = req.params;
            await assertAttachmentAccess(id, { userId, role });
            await deleteAttachment(id);

            return res.status(200).json({
                status: 'success',
                message: 'Attachment deleted successfully',
            });
        } catch (error: any) {
            logger.error('Delete error:', error);
            return respondWithError(res, error);
        }
    },

    /**
     * Get attachments for a work item
     */
    getByWorkItem: async (req: Request, res: Response) => {
        try {
            const { userId, role } = getRequestActor(req);
            let { workItemId } = req.params;

            if (workItemId) {
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workItemId);
                if (!isUUID) {
                    const resolved = await prisma.workItem.findFirst({
                        where: { key: workItemId, deletedAt: null },
                        select: { id: true }
                    });
                    if (!resolved) {
                        throw new AppError('Work item not found', 404);
                    }
                    workItemId = resolved.id;
                }
            }

            await ProjectAccess.checkByWorkItem(workItemId, userId, role);
            const attachments = await getAttachmentsByWorkItem(workItemId);
            return res.status(200).json({ status: 'success', data: attachments });
        } catch (error: any) {
            return respondWithError(res, error);
        }
    },

    /**
     * Get attachments for a comment
     */
    getByComment: async (req: Request, res: Response) => {
        try {
            const { userId, role } = getRequestActor(req);
            const { commentId } = req.params;
            await ProjectAccess.checkByComment(commentId, userId, role);
            const attachments = await getAttachmentsByComment(commentId);
            return res.status(200).json({ status: 'success', data: attachments });
        } catch (error: any) {
            return respondWithError(res, error);
        }
    },

    /**
     * Get attachments for a test result (evidence)
     */
    getByTestResult: async (req: Request, res: Response) => {
        try {
            const { userId, role } = getRequestActor(req);
            const { testResultId } = req.params;
            await ProjectAccess.checkByTestResult(testResultId, userId, role);
            const attachments = await getAttachmentsByTestResult(testResultId);
            return res.status(200).json({ status: 'success', data: attachments });
        } catch (error: any) {
            return respondWithError(res, error);
        }
    },

    /**
     * Get attachments (step images) for a test case
     */
    getByTestCase: async (req: Request, res: Response) => {
        try {
            const { userId, role } = getRequestActor(req);
            const { testCaseId } = req.params;
            await ProjectAccess.checkByTestCase(testCaseId, userId, role);
            const attachments = await getAttachmentsByTestCase(testCaseId);
            return res.status(200).json({ status: 'success', data: attachments });
        } catch (error: any) {
            return respondWithError(res, error);
        }
    },

    /**
     * Get attachments (images) for a wiki page
     */
    getByWikiPage: async (req: Request, res: Response) => {
        try {
            const { userId, role } = getRequestActor(req);
            const { wikiPageId } = req.params;
            await ProjectAccess.checkByWikiPage(wikiPageId, userId, role);
            const attachments = await getAttachmentsByWikiPage(wikiPageId);
            return res.status(200).json({ status: 'success', data: attachments });
        } catch (error: any) {
            return respondWithError(res, error);
        }
    },
};
