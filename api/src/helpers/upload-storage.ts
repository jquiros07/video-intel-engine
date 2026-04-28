import path from 'path';
import { BlobServiceClient, BlobSASPermissions } from '@azure/storage-blob';
import { requireEnv } from './utilities';

const SAS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const getContainerClient = () => {
    return BlobServiceClient
        .fromConnectionString(requireEnv('AZURE_STORAGE_CONNECTION_STRING'))
        .getContainerClient(process.env.AZURE_BLOB_CONTAINER_NAME || 'videos');
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

    const videoUrl = await blobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse('r'),
        expiresOn: new Date(Date.now() + SAS_TTL_MS),
    });

    return { blobName: fileName, videoUrl };
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
