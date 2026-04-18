import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { QueueClient } from '@azure/storage-queue';
import { prisma } from '../db';
import {
    deleteStoredVideo,
    getFileExtension,
    sanitizeUploadFileName,
    uploadVideoBuffer
} from '../upload-storage';
import { requireEnv } from '../utilities';

export const processVideo = async (req: Request, res: Response): Promise<Response> => {
    let uploadedVideo: { blobName: string; videoUrl: string; } | null = null;
    let jobId: string | null = null;

    try {
        uploadedVideo = await storeUploadedVideo(req);
        const videoUrl = uploadedVideo?.videoUrl ?? req.body?.videoUrl;

        if (!videoUrl || typeof videoUrl !== 'string') {
            return res.status(422).json({
                message: 'Validation failed',
                data: { video: ['Send a raw video upload or provide videoUrl'] }
            });
        }

        const job = await prisma.videoProcessing.create({
            data: {
                videoUrl,
                status: 'PENDING'
            }
        });
        jobId = job.id;

        const queueClient = new QueueClient(
            requireEnv('AZURE_STORAGE_CONNECTION_STRING'),
            process.env.AZURE_QUEUE_NAME || 'video-processing-queue'
        );
        await queueClient.createIfNotExists();
        await queueClient.sendMessage(JSON.stringify({
            id: job.id,
            videoUrl: job.videoUrl,
            blobName: uploadedVideo?.blobName
        }));

        return res.status(202).json({
            message: 'Video queued for processing',
            data: {
                jobId: job.id,
                status: job.status,
                videoUrl: job.videoUrl
            }
        });
    } catch (error) {
        if (uploadedVideo && !jobId) {
            await deleteStoredVideo(uploadedVideo.blobName).catch(() => null);
        }

        console.error('Error queuing video for processing', error);
        return res.status(500).json({ message: 'Internal server error', data: null });
    }
};

const storeUploadedVideo = async (req: Request): Promise<{ blobName: string; videoUrl: string; } | null> => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return null;
    }

    const requestedFileName = getRequestedFileName(req);
    const safeFileName = sanitizeUploadFileName(requestedFileName);
    const extension = getFileExtension(safeFileName) || getExtensionFromMimeType(req.header('content-type'));
    const storedFileName = `${Date.now()}-${randomUUID()}${extension}`;

    return uploadVideoBuffer(
        storedFileName,
        req.body,
        req.header('content-type') || 'application/octet-stream'
    );
};

const getRequestedFileName = (req: Request): string => {
    const headerFileName = req.header('x-file-name');
    const queryFileName = typeof req.query.fileName === 'string' ? req.query.fileName : undefined;

    return headerFileName || queryFileName || `video-upload${getExtensionFromMimeType(req.header('content-type'))}`;
};

const getExtensionFromMimeType = (mimeType?: string): string => {
    const normalizedMimeType = mimeType?.split(';')[0]?.trim().toLowerCase();

    switch (normalizedMimeType) {
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
