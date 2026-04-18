import path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import { requireEnv } from './utilities';

const getContainerClient = () => {
    return BlobServiceClient
        .fromConnectionString(requireEnv('AZURE_STORAGE_CONNECTION_STRING'))
        .getContainerClient(process.env.AZURE_BLOB_CONTAINER_NAME || 'videos');
};

const buildVideoUrl = (blobUrl: string, fileName: string): string => {
    const publicBaseUrl = process.env.AZURE_BLOB_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');

    if (!publicBaseUrl) {
        return blobUrl;
    }

    return `${publicBaseUrl}/${encodeURIComponent(fileName)}`;
};

export const uploadVideoBuffer = async (
    fileName: string,
    content: Buffer,
    contentType?: string,
): Promise<{ blobName: string; videoUrl: string; }> => {
    const containerClient = getContainerClient();
    await containerClient.createIfNotExists();

    const blobClient = containerClient.getBlockBlobClient(fileName);
    await blobClient.uploadData(content, {
        blobHTTPHeaders: contentType ? { blobContentType: contentType } : undefined
    });

    return {
        blobName: fileName,
        videoUrl: buildVideoUrl(blobClient.url, fileName)
    };
};

export const deleteStoredVideo = async (blobName: string): Promise<void> => {
    const containerClient = getContainerClient();

    try {
        await containerClient.deleteBlob(blobName);
    } catch (error) {
        if ((error as { statusCode?: number; }).statusCode !== 404) {
            throw error;
        }
    }
};

export const sanitizeUploadFileName = (fileName: string): string => {
    const baseName = path.basename(fileName).trim();
    const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return sanitized || 'video-upload.bin';
};

export const getFileExtension = (fileName: string): string => {
    return path.extname(fileName);
};
