import { Request, Response } from 'express';
import { createClient } from 'redis';
import { prisma } from '../db';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'video_processing_queue';

export const processVideo = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { videoUrl } = req.body;

        if (!videoUrl || typeof videoUrl !== 'string') {
            return res.status(422).json({ message: 'Validation failed', data: { videoUrl: ['videoUrl is required'] } });
        }

        // Create a record in the database
        const job = await prisma.videoProcessing.create({
            data: {
                videoUrl: videoUrl,
                status: 'PENDING'
            }
        });

        // Push the job to the Redis queue for the Python processor
        const redisClient = createClient({ url: REDIS_URL });
        await redisClient.connect();
        await redisClient.lPush(QUEUE_NAME, JSON.stringify({ id: job.id, videoUrl: job.videoUrl }));
        await redisClient.disconnect();

        return res.status(202).json({
            message: 'Video queued for processing',
            data: { jobId: job.id, status: job.status }
        });
    } catch (error) {
        console.error('Error queuing video for processing', error);
        return res.status(500).json({ message: 'Internal server error', data: null });
    }
};
