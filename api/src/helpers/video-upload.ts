import { randomUUID } from 'crypto';
import { Request } from 'express';
import { getFileExtension, sanitizeUploadFileName, uploadVideoBuffer } from './upload-storage';
import { StoredVideoUpload } from '../types/StoredVideoUpload';

export type { StoredVideoUpload };

const DEFAULT_VIDEO_FILE_NAME = 'video-upload';
const DEFAULT_VIDEO_UPLOAD_CONTENT_TYPE = 'application/octet-stream';

export const storeUploadedVideo = async (req: Request): Promise<StoredVideoUpload | null> => {
    if (!req.file || !Buffer.isBuffer(req.file.buffer) || req.file.size === 0) {
        return null;
    }

    const mimeType = req.file.mimetype.split(';')[0].trim().toLowerCase();
    const requestedFileName = req.file.originalname?.trim() || `${DEFAULT_VIDEO_FILE_NAME}${getExtensionFromMimeType(mimeType)}`;
    const safeFileName = sanitizeUploadFileName(requestedFileName);
    const extension = getFileExtension(safeFileName) || getExtensionFromMimeType(mimeType);
    const storedFileName = `${Date.now()}-${randomUUID()}${extension}`;

    return uploadVideoBuffer(
        storedFileName,
        req.file.buffer,
        mimeType || DEFAULT_VIDEO_UPLOAD_CONTENT_TYPE
    );
};

function getExtensionFromMimeType(mimeType?: string): string {
    switch (mimeType) {
        case 'video/mp4':       return '.mp4';
        case 'video/quicktime': return '.mov';
        case 'video/x-msvideo': return '.avi';
        case 'video/x-matroska': return '.mkv';
        case 'video/webm':      return '.webm';
        default:                return '.bin';
    }
}
