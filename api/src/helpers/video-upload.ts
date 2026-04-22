import { randomUUID } from 'crypto';
import { Request } from 'express';
import {
    getFileExtension,
    sanitizeUploadFileName,
    uploadVideoBuffer
} from './upload-storage';

const DEFAULT_VIDEO_UPLOAD_LIMIT = '500mb';
const DEFAULT_VIDEO_FILE_NAME = 'video-upload';
const DEFAULT_VIDEO_UPLOAD_CONTENT_TYPE = 'application/octet-stream';
const ALLOWED_VIDEO_MIME_TYPES = new Set([
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm'
]);

export type UploadValidationError = {
    status: number;
    data: Record<string, string[]>;
};

export type StoredVideoUpload = {
    blobName: string;
    videoUrl: string;
};

export const validateVideoUpload = (req: Request): UploadValidationError | null => {
    if (!Buffer.isBuffer(req.body)) {
        return null;
    }

    if (req.body.length === 0) {
        return {
            status: 422,
            data: { video: ['Video file is empty'] }
        };
    }

    const mimeType = normalizeMimeType(req.header('content-type'));

    if (!mimeType || !ALLOWED_VIDEO_MIME_TYPES.has(mimeType)) {
        return {
            status: 422,
            data: { video: [`Unsupported video mime type. Allowed types: ${Array.from(ALLOWED_VIDEO_MIME_TYPES).join(', ')}`] }
        };
    }

    if (req.body.length > getUploadLimitInBytes()) {
        return {
            status: 413,
            data: { video: [`Video file is too large. Max size is ${process.env.VIDEO_UPLOAD_LIMIT || DEFAULT_VIDEO_UPLOAD_LIMIT}`] }
        };
    }

    return null;
};

export const storeUploadedVideo = async (req: Request): Promise<StoredVideoUpload | null> => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return null;
    }

    const mimeType = normalizeMimeType(req.header('content-type'));
    const requestedFileName = getRequestedFileName(req, mimeType);
    const safeFileName = sanitizeUploadFileName(requestedFileName);
    const extension = getFileExtension(safeFileName) || getExtensionFromMimeType(mimeType);
    const storedFileName = `${Date.now()}-${randomUUID()}${extension}`;

    return uploadVideoBuffer(
        storedFileName,
        req.body,
        mimeType || DEFAULT_VIDEO_UPLOAD_CONTENT_TYPE
    );
};

const getRequestedFileName = (req: Request, mimeType?: string): string => {
    const headerFileName = req.header('x-file-name');
    const queryFileName = typeof req.query.fileName === 'string' ? req.query.fileName : undefined;

    return headerFileName || queryFileName || `${DEFAULT_VIDEO_FILE_NAME}${getExtensionFromMimeType(mimeType)}`;
};

const getExtensionFromMimeType = (mimeType?: string): string => {
    switch (mimeType) {
        case 'video/mp4':
            return '.mp4';
        case 'video/quicktime':
            return '.mov';
        case 'video/x-msvideo':
            return '.avi';
        case 'video/x-matroska':
            return '.mkv';
        case 'video/webm':
            return '.webm';
        default:
            return '.bin';
    }
};

const normalizeMimeType = (mimeType?: string): string | undefined => {
    return mimeType?.split(';')[0]?.trim().toLowerCase();
};

const getUploadLimitInBytes = (): number => {
    const rawLimit = (process.env.VIDEO_UPLOAD_LIMIT || DEFAULT_VIDEO_UPLOAD_LIMIT).trim().toLowerCase();
    const match = rawLimit.match(/^(\d+)(b|kb|mb|gb)?$/);

    if (!match) {
        return 500 * 1024 * 1024;
    }

    const size = Number(match[1]);
    const unit = match[2] || 'b';

    switch (unit) {
        case 'gb':
            return size * 1024 * 1024 * 1024;
        case 'mb':
            return size * 1024 * 1024;
        case 'kb':
            return size * 1024;
        default:
            return size;
    }
};
