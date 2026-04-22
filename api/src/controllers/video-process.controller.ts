import { Request, Response } from 'express';
import { QueueClient } from '@azure/storage-queue';
import { prisma } from '../db';
import { deleteStoredVideo } from '../helpers/upload-storage';
import { requireEnv } from '../helpers/utilities';
import { storeUploadedVideo, validateVideoUpload } from '../helpers/video-upload';

export const processVideo = async (req: Request, res: Response): Promise<Response> => {
    let uploadedVideo: { blobName: string; videoUrl: string; } | null = null;
    let jobId: string | null = null;

    try {
        const uploadValidationError = validateVideoUpload(req);

        if (uploadValidationError) {
            return res.status(uploadValidationError.status).json({
                message: 'Validation failed',
                data: uploadValidationError.data
            });
        }

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
