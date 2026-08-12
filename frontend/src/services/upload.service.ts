import { api } from './api';
import i18n from '@/lib/i18n';

export interface UploadResult {
    id: string;
    filename: string;
    mimetype: string;
    size: number;
    url: string;
}

export interface AttachmentMeta {
    id: string;
    filename: string;
    mimetype: string;
    size: number;
    url: string;
    category: string;
    createdAt: string;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const ALLOWED_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const getBackendBaseUrl = (): string => {
    const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
    return new URL(apiUrl, window.location.origin).origin;
};

/**
 * Check if a file is a video
 */
export const isVideoFile = (mimetype: string): boolean =>
    ALLOWED_VIDEO_TYPES.includes(mimetype);

/**
 * Check if a file is an image
 */
export const isImageFile = (mimetype: string): boolean =>
    ALLOWED_IMAGE_TYPES.includes(mimetype);

/**
 * Validate a media file before upload (supports both images and videos)
 */
export const validateMediaFile = (file: File): string | null => {
    if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
        return i18n.t('upload.unsupported_type', { type: file.type });
    }

    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (file.size > maxSize) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
        return i18n.t('upload.max_size_exceeded', { sizeMB, maxMB });
    }
    return null;
};

/**
 * @deprecated Use validateMediaFile instead
 */
export const validateImageFile = validateMediaFile;

/**
 * Upload a media file (image or video) — stored in MinIO
 */
export const uploadMedia = async (
    file: File,
    options?: {
        workItemId?: string;
        commentId?: string;
        testResultId?: string;
        testCaseId?: string;
        wikiPageId?: string;
        category?: string;
    },
): Promise<UploadResult> => {
    const error = validateMediaFile(file);
    if (error) throw new Error(error);

    const formData = new FormData();
    formData.append('file', file);
    if (options?.workItemId) formData.append('workItemId', options.workItemId);
    if (options?.commentId) formData.append('commentId', options.commentId);
    if (options?.testResultId) formData.append('testResultId', options.testResultId);
    if (options?.testCaseId) formData.append('testCaseId', options.testCaseId);
    if (options?.wikiPageId) formData.append('wikiPageId', options.wikiPageId);
    if (options?.category) formData.append('category', options.category);

    const response = await api.post('/storage/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

    // response is already the JSON body { status, data: { url... } } thanks to interceptor
    return response.data;
};

/**
 * @deprecated Use uploadMedia instead
 */
export const uploadImage = uploadMedia;

/**
 * Delete an attachment
 */
export const deleteImage = async (id: string): Promise<void> => {
    await api.delete(`/storage/attachments/${id}`);
};

/**
 * Get attachments for a work item
 */
export const getWorkItemAttachments = async (workItemId: string): Promise<AttachmentMeta[]> => {
    const response = await api.get(`/storage/work-items/${workItemId}/attachments`);
    return response.data;
};

/**
 * Get attachments for a test result (evidence)
 */
export const getTestResultAttachments = async (testResultId: string): Promise<AttachmentMeta[]> => {
    const response = await api.get(`/storage/test-results/${testResultId}/attachments`);
    return response.data;
};

/**
 * Get attachments for a test case (step images)
 */
export const getTestCaseAttachments = async (testCaseId: string): Promise<AttachmentMeta[]> => {
    const response = await api.get(`/storage/test-cases/${testCaseId}/attachments`);
    return response.data;
};

/**
 * Get attachments for a wiki page
 */
export const getWikiPageAttachments = async (wikiPageId: string): Promise<AttachmentMeta[]> => {
    const response = await api.get(`/storage/wiki-pages/${wikiPageId}/attachments`);
    return response.data;
};

/**
 * Get the full URL for an attachment streamed by the backend.
 */
export const getImageUrl = (urlOrId: string): string => {
    // Preserve full URLs for backward-compatible records.
    if (urlOrId.startsWith('http://') || urlOrId.startsWith('https://')) {
        return urlOrId;
    }
    // If it's already an API path, prepend backend base
    if (urlOrId.startsWith('/api/')) {
        return `${getBackendBaseUrl()}${urlOrId}`;
    }
    // If it's a UUID (attachment id), construct the streaming URL.
    return `${getBackendBaseUrl()}/api/v1/storage/attachments/${urlOrId}`;
};

/** Alias for getImageUrl — works for both images and videos */
export const getMediaUrl = getImageUrl;

export const uploadService = {
    uploadMedia,
    uploadImage,
    deleteImage,
    validateMediaFile,
    validateImageFile,
    getImageUrl,
    getMediaUrl,
    getWorkItemAttachments,
    getTestResultAttachments,
    getTestCaseAttachments,
    getWikiPageAttachments,
    isVideoFile,
    isImageFile,
    MAX_IMAGE_SIZE,
    MAX_VIDEO_SIZE,
    ALLOWED_IMAGE_TYPES,
    ALLOWED_VIDEO_TYPES,
    ALLOWED_MEDIA_TYPES,
};
