import { Request, Response } from 'express';
import { QueueClient } from '@azure/storage-queue';
import { prisma } from '../db';
import { VideoProcessingStatus } from '../enums/video-processing-status.enum';
import { deleteStoredVideo } from '../helpers/upload-storage';
import { sendProcessResultsEmailMessage } from '../helpers/process-results-email';
import { requireEnv } from '../helpers/utilities';
import { storeUploadedVideo, validateVideoUpload } from '../helpers/video-upload';
import { AuthenticatedRequest } from '../types/AuthenticatedRequest';
import Validator from 'validatorjs';

export const processVideo = async (req: Request, res: Response): Promise<Response> => {
    const authenticatedRequest = req as AuthenticatedRequest;
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
                data: { video: ['Send multipart/form-data with a file field named "file" or provide videoUrl'] }
            });
        }

        if (!authenticatedRequest.accessEmail) {
            return res.status(403).json({
                message: 'Forbidden',
                data: null
            });
        }

        const job = await prisma.videoProcessing.create({
            data: {
                email: authenticatedRequest.accessEmail,
                videoUrl,
                status: VideoProcessingStatus.PENDING
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

        return res.status(201).json({
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

export const sendProcessResultsEmail = async (req: Request, res: Response): Promise<Response> => {
    try {
        const validationRules = {
            videoProcessingId: 'string|required'
        };
        const validator = new Validator(req.body, validationRules);

        if (validator.fails()) {
            return res.status(422).json({
                message: 'Validation failed',
                data: validator.errors.all()
            });
        }

        const videoProcessing = await prisma.videoProcessing.findUnique({
            where: { id: req.body.videoProcessingId }
        });

        if (!videoProcessing) {
            return res.status(404).json({
                message: 'Video processing not found',
                data: null
            });
        }

        if (!videoProcessing.resultData) {
            return res.status(409).json({
                message: 'Video processing results are not available yet',
                data: {
                    status: videoProcessing.status
                }
            });
        }

        await sendProcessResultsEmailMessage({
            to: videoProcessing.email,
            videoProcessingId: videoProcessing.id,
            videoUrl: videoProcessing.videoUrl,
            status: videoProcessing.status,
            resultData: videoProcessing.resultData
        });

        return res.status(200).json({
            message: 'Process results email sent successfully',
            data: {
                videoProcessingId: videoProcessing.id,
                email: videoProcessing.email
            }
        });
    } catch (error) {
        console.error('Error sending process results email', error);
        return res.status(500).json({ message: 'Internal server error', data: null });
    }
};
