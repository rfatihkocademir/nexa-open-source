import { Client } from 'minio';
import net from 'net';
import { createLogger } from '../utils/logger';

// ─── MinIO Configuration ────────────────────────────────────────────────────

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY;
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'nexa';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const logger = createLogger('MinIO');

// ─── Presigned URL Expiry (seconds) ─────────────────────────────────────────

const PRESIGNED_GET_EXPIRY = 7 * 24 * 60 * 60;  // 7 days
// const PRESIGNED_PUT_EXPIRY = 60 * 60;            // 1 hour

// ─── Object Key Prefixes ────────────────────────────────────────────────────

export const STORAGE_PREFIX = {
    EVIDENCE: 'evidence',
    WORK_ITEM: 'work-items',
    COMMENT: 'comments',
    STEP_IMAGE: 'step-images',
    WIKI: 'wiki',
    AVATAR: 'avatars',
    PROJECT_LOGO: 'project-logos',
    AUTOMATION_VIDEO: 'automation-videos',
} as const;

export type StoragePrefix = typeof STORAGE_PREFIX[keyof typeof STORAGE_PREFIX];

// ─── MinIO Client Singleton ─────────────────────────────────────────────────

const minioClient = new Client({
    endPoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    useSSL: MINIO_USE_SSL,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY,
});

// ─── Bucket Initialization ──────────────────────────────────────────────────

let bucketReady = false;
export async function isMinioAvailable(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
            const socket = net.createConnection({ host: MINIO_ENDPOINT, port: MINIO_PORT });

            const finalize = (value: boolean) => {
                socket.removeAllListeners();
                socket.destroy();
                resolve(value);
            };

            socket.setTimeout(1000);
            socket.once('connect', () => finalize(true));
            socket.once('timeout', () => finalize(false));
            socket.once('error', () => finalize(false));
    });
}

export async function ensureBucket(): Promise<void> {
    if (bucketReady) return;

    const minioEnabled = await isMinioAvailable();
    if (!minioEnabled) {
        throw new Error('MinIO is unavailable');
    }

    try {
        const exists = await minioClient.bucketExists(MINIO_BUCKET);
        if (!exists) {
            await minioClient.makeBucket(MINIO_BUCKET, 'us-east-1');
            logger.info(`Bucket "${MINIO_BUCKET}" created`);

            logger.info(`Private bucket "${MINIO_BUCKET}" created`);
        } else {
            logger.info(`Bucket "${MINIO_BUCKET}" already exists`);
        }
        bucketReady = true;
    } catch (error) {
        throw error;
    }
}

// ─── Core Operations ────────────────────────────────────────────────────────

/**
 * Generate a unique object key with prefix-based organization:
 *   {prefix}/{entityId}/{timestamp}-{originalFilename}
 */
export function generateObjectKey(
    prefix: StoragePrefix,
    entityId: string,
    filename: string,
): string {
    const timestamp = Date.now();
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${prefix}/${entityId}/${timestamp}-${sanitized}`;
}

/**
 * Upload a file buffer to MinIO.
 * Returns the object key for later reference.
 */
export async function uploadFile(
    objectKey: string,
    buffer: Buffer,
    mimetype: string,
    metadata?: Record<string, string>,
): Promise<string> {
    await ensureBucket();

    await minioClient.putObject(
        MINIO_BUCKET,
        objectKey,
        buffer,
        buffer.length,
        {
            'Content-Type': mimetype,
            ...metadata,
        },
    );

    return objectKey;
}

/**
 * Upload a file from a local filesystem path to MinIO.
 * Useful for uploading Playwright video artifacts.
 */
export async function uploadFileFromPath(
    objectKey: string,
    filePath: string,
    mimetype: string,
    metadata?: Record<string, string>,
): Promise<string> {
    await ensureBucket();

    await minioClient.fPutObject(
        MINIO_BUCKET,
        objectKey,
        filePath,
        {
            'Content-Type': mimetype,
            ...metadata,
        },
    );

    return objectKey;
}

/**
 * Get a presigned GET URL for serving a file.
 * URL is valid for PRESIGNED_GET_EXPIRY seconds.
 */
export async function getPresignedUrl(objectKey: string): Promise<string> {
    await ensureBucket();
    return minioClient.presignedGetObject(MINIO_BUCKET, objectKey, PRESIGNED_GET_EXPIRY);
}

/**
 * Get a public URL for serving a file (without presigning).
 * Works when bucket has public read policy.
 */
export function getPublicUrl(objectKey: string): string {
    const protocol = MINIO_USE_SSL ? 'https' : 'http';
    return `${protocol}://${MINIO_ENDPOINT}:${MINIO_PORT}/${MINIO_BUCKET}/${objectKey}`;
}

/**
 * Delete a file from MinIO.
 */
export async function deleteFile(objectKey: string): Promise<void> {
    await ensureBucket();
    await minioClient.removeObject(MINIO_BUCKET, objectKey);
}

/**
 * Delete multiple files from MinIO (batch delete).
 */
export async function deleteFiles(objectKeys: string[]): Promise<void> {
    if (objectKeys.length === 0) return;
    await ensureBucket();
    await minioClient.removeObjects(MINIO_BUCKET, objectKeys);
}

/**
 * Get file stats (size, last modified, etc.)
 */
export async function getFileStat(objectKey: string) {
    await ensureBucket();
    return minioClient.statObject(MINIO_BUCKET, objectKey);
}

/**
 * Stream a file from MinIO (for proxying).
 */
export async function getFileStream(objectKey: string) {
    await ensureBucket();
    return minioClient.getObject(MINIO_BUCKET, objectKey);
}

// ─── Allowed MIME Types ─────────────────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
];

export const ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
];

export const ALLOWED_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024;   // 100MB

/**
 * Validate a file's type and size.
 */
export function validateFile(
    mimetype: string,
    size: number,
    allowVideo: boolean = true,
): string | null {
    const allowed = allowVideo ? ALLOWED_MEDIA_TYPES : ALLOWED_IMAGE_TYPES;
    if (!allowed.includes(mimetype)) {
        return `Desteklenmeyen dosya tipi: ${mimetype}`;
    }

    const isVideo = ALLOWED_VIDEO_TYPES.includes(mimetype);
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (size > maxSize) {
        const sizeMB = (size / (1024 * 1024)).toFixed(1);
        const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
        return `Dosya boyutu çok büyük: ${sizeMB}MB. Maksimum: ${maxMB}MB`;
    }

    return null;
}

export function validateFileSignature(mimetype: string, buffer: Buffer): string | null {
    if (!buffer?.length) return 'Dosya içeriği boş olamaz.';
    const startsWith = (...bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);
    const isFtyp = buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp';

    const valid = {
        'image/jpeg': startsWith(0xff, 0xd8, 0xff),
        'image/png': startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
        'image/gif': buffer.toString('ascii', 0, 4) === 'GIF8',
        'image/webp': buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
        'image/bmp': buffer.toString('ascii', 0, 2) === 'BM',
        'video/mp4': isFtyp,
        'video/quicktime': isFtyp,
        'video/webm': startsWith(0x1a, 0x45, 0xdf, 0xa3),
        'video/ogg': buffer.toString('ascii', 0, 4) === 'OggS',
    } as Record<string, boolean>;

    return valid[mimetype] === true ? null : `Dosya içeriği ${mimetype} MIME tipiyle eşleşmiyor.`;
}

// ─── Export Service Object ──────────────────────────────────────────────────

export const minioService = {
    ensureBucket,
    generateObjectKey,
    uploadFile,
    uploadFileFromPath,
    getPresignedUrl,
    getPublicUrl,
    deleteFile,
    deleteFiles,
    getFileStat,
    getFileStream,
    validateFile,
    validateFileSignature,
    STORAGE_PREFIX,
    ALLOWED_IMAGE_TYPES,
    ALLOWED_VIDEO_TYPES,
    ALLOWED_MEDIA_TYPES,
    MAX_IMAGE_SIZE,
    MAX_VIDEO_SIZE,
};
