import multer from 'multer';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';
import {
    uploadFile,
    deleteFile,
    getFileStream,
    generateObjectKey,
    ALLOWED_MEDIA_TYPES,
    MAX_VIDEO_SIZE,
    validateFile,
    validateFileSignature,
    STORAGE_PREFIX,
    type StoragePrefix,
} from './minio.service';
import type { AttachmentCategory } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('StorageService');

// ─── Multer Memory Storage (buffer → MinIO) ────────────────────────────────

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_MEDIA_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Desteklenmeyen dosya tipi: ${file.mimetype}. Görsel ve video dosyaları kabul edilir.`));
    }
};

const uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_VIDEO_SIZE }, // 100MB (largest allowed)
    fileFilter,
});

export const upload = uploadMiddleware;

const getAttachmentContextCount = (options?: SaveAttachmentOptions) =>
    [
        options?.workItemId,
        options?.commentId,
        options?.testResultId,
        options?.testCaseId,
        options?.wikiPageId,
    ].filter(Boolean).length;

export const assertAttachmentTargetAccess = async (options: SaveAttachmentOptions | undefined, access: AccessContext) => {
    const targetCount = getAttachmentContextCount(options);

    if (targetCount > 1) {
        throw new AppError('Attachment must be linked to only one target entity', 400);
    }

    if (options?.workItemId) {
        await ProjectAccess.checkByWorkItem(options.workItemId, access.userId, access.role);
    } else if (options?.commentId) {
        await ProjectAccess.checkByComment(options.commentId, access.userId, access.role);
    } else if (options?.testResultId) {
        await ProjectAccess.checkByTestResult(options.testResultId, access.userId, access.role);
    } else if (options?.testCaseId) {
        await ProjectAccess.checkByTestCase(options.testCaseId, access.userId, access.role);
    } else if (options?.wikiPageId) {
        await ProjectAccess.checkByWikiPage(options.wikiPageId, access.userId, access.role);
    }
};

// ─── MinIO-backed Attachment Operations ─────────────────────────────────────

interface SaveAttachmentOptions {
    workItemId?: string;
    commentId?: string;
    testResultId?: string;
    testCaseId?: string;
    wikiPageId?: string;
    category?: AttachmentCategory;
    prefix?: StoragePrefix;
}

interface AccessContext {
    userId: string;
    role: string;
}

/**
 * Upload file to MinIO and create Attachment record in DB (metadata only).
 */
export const saveAttachment = async (
    buffer: Buffer,
    filename: string,
    mimetype: string,
    size: number,
    uploadedById: string,
    options?: SaveAttachmentOptions,
) => {
    const validationError = validateFile(mimetype, size, true);
    if (validationError) throw new AppError(validationError, 400);
    const signatureError = validateFileSignature(mimetype, buffer);
    if (signatureError) throw new AppError(signatureError, 400);

    // Determine entity ID and prefix for object key
    const entityId =
        options?.workItemId ||
        options?.commentId ||
        options?.testResultId ||
        options?.testCaseId ||
        options?.wikiPageId ||
        'general';

    const prefix = options?.prefix || STORAGE_PREFIX.WORK_ITEM;
    const objectKey = generateObjectKey(prefix, entityId, filename);

    // Upload to MinIO
    await uploadFile(objectKey, buffer, mimetype);

    try {
        // Create DB record (metadata only — no binary data)
        return await prisma.attachment.create({
            data: {
                filename,
                mimetype,
                size,
                objectKey,
                category: options?.category || 'GENERAL',
                uploadedById,
                workItemId: options?.workItemId,
                commentId: options?.commentId,
                testResultId: options?.testResultId,
                testCaseId: options?.testCaseId,
                wikiPageId: options?.wikiPageId,
            },
            select: {
                id: true,
                filename: true,
                mimetype: true,
                size: true,
                objectKey: true,
                category: true,
                createdAt: true,
            },
        });
    } catch (error) {
        await deleteFile(objectKey).catch((cleanupError) => logger.warn('Failed to clean up orphaned upload:', cleanupError.message));
        throw error;
    }
};

/**
 * Get attachment metadata for authenticated streaming through the API.
 */
export const getAttachment = async (id: string) => {
    const attachment = await prisma.attachment.findFirst({
        where: { id, deletedAt: null },
        select: {
            id: true,
            filename: true,
            mimetype: true,
            size: true,
            objectKey: true,
            createdAt: true,
        },
    });

    if (!attachment) return null;

    return attachment;
};

/**
 * Open an attachment stream after the caller has completed authorization.
 */
export const getAttachmentStream = async (id: string) => {
    const attachment = await prisma.attachment.findFirst({
        where: { id, deletedAt: null },
        select: { objectKey: true, filename: true, mimetype: true, size: true },
    });

    if (!attachment) return null;
    return {
        ...attachment,
        stream: await getFileStream(attachment.objectKey),
    };
};

export const updateAttachment = async (id: string, data: { filename?: string; category?: AttachmentCategory }) => {
    return prisma.attachment.update({
        where: { id, deletedAt: null },
        data,
    });
};

/**
 * Soft delete attachment (DB only).
 */
export const archiveAttachment = async (id: string) => {
    return prisma.attachment.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
};

/**
 * Restore soft-deleted attachment.
 */
export const restoreAttachment = async (id: string) => {
    return prisma.attachment.update({
        where: { id },
        data: { deletedAt: null },
    });
};

/**
 * Delete attachment from both MinIO and DB (Hard Delete).
 */
export const hardDeleteAttachment = async (id: string) => {
    const attachment = await prisma.attachment.findUnique({
        where: { id },
        select: { objectKey: true, thumbnailKey: true },
    });

    if (attachment) {
        // Delete from MinIO
        await deleteFile(attachment.objectKey).catch((err) =>
            logger.warn('Failed to delete from MinIO:', err.message)
        );

        // Delete thumbnail if exists
        if (attachment.thumbnailKey) {
            await deleteFile(attachment.thumbnailKey).catch(() => {});
        }
    }

    // Delete DB record
    return prisma.attachment.delete({ where: { id } });
};

/**
 * Backward compatibility or default delete behavior.
 */
export const deleteAttachment = archiveAttachment;

export const assertAttachmentAccess = async (id: string, access: AccessContext) => {
    await ProjectAccess.checkByAttachment(id, access.userId, access.role);
};

export const assertAttachmentsAccessible = async (attachmentIds: string[], access: AccessContext) => {
    await Promise.all(attachmentIds.map((attachmentId) => assertAttachmentAccess(attachmentId, access)));
};

/**
 * Get attachments for a work item.
 */
export const getAttachmentsByWorkItem = async (workItemId: string) => {
    const attachments = await prisma.attachment.findMany({
        where: { workItemId, deletedAt: null },
        select: {
            id: true,
            filename: true,
            mimetype: true,
            size: true,
            objectKey: true,
            category: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    return attachments.map(({ objectKey: _objectKey, ...attachment }) => ({
        ...attachment,
        url: `/api/v1/storage/attachments/${attachment.id}`,
    }));
};

/**
 * Get attachments for a comment (metadata + URLs).
 */
export const getAttachmentsByComment = async (commentId: string) => {
    const attachments = await prisma.attachment.findMany({
        where: { commentId, deletedAt: null },
        select: {
            id: true,
            filename: true,
            mimetype: true,
            size: true,
            objectKey: true,
            category: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    return attachments.map(({ objectKey: _objectKey, ...attachment }) => ({
        ...attachment,
        url: `/api/v1/storage/attachments/${attachment.id}`,
    }));
};

/**
 * Get attachments for a test result.
 */
export const getAttachmentsByTestResult = async (testResultId: string) => {
    const attachments = await prisma.attachment.findMany({
        where: { testResultId, deletedAt: null },
        select: {
            id: true,
            filename: true,
            mimetype: true,
            size: true,
            objectKey: true,
            category: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    return attachments.map(({ objectKey: _objectKey, ...attachment }) => ({
        ...attachment,
        url: `/api/v1/storage/attachments/${attachment.id}`,
    }));
};

/**
 * Get attachments for a test case (step images).
 */
export const getAttachmentsByTestCase = async (testCaseId: string) => {
    const attachments = await prisma.attachment.findMany({
        where: { testCaseId, deletedAt: null },
        select: {
            id: true,
            filename: true,
            mimetype: true,
            size: true,
            objectKey: true,
            category: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    return attachments.map(({ objectKey: _objectKey, ...attachment }) => ({
        ...attachment,
        url: `/api/v1/storage/attachments/${attachment.id}`,
    }));
};

/**
 * Get attachments for a wiki page.
 */
export const getAttachmentsByWikiPage = async (wikiPageId: string) => {
    const attachments = await prisma.attachment.findMany({
        where: { wikiPageId, deletedAt: null },
        select: {
            id: true,
            filename: true,
            mimetype: true,
            size: true,
            objectKey: true,
            category: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    return attachments.map(({ objectKey: _objectKey, ...attachment }) => ({
        ...attachment,
        url: `/api/v1/storage/attachments/${attachment.id}`,
    }));
};
