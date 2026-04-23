import { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';

const ALLOWED_VIDEO_MIME_TYPES = new Set([
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm'
]);

const DEFAULT_VIDEO_UPLOAD_LIMIT = '500mb';

const multipartVideoUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: getSizeLimitInBytes(process.env.VIDEO_UPLOAD_LIMIT || DEFAULT_VIDEO_UPLOAD_LIMIT)
    },
    fileFilter: (_req, file, cb) => {
        const mimeType = file.mimetype.split(';')[0].trim().toLowerCase();
        if (ALLOWED_VIDEO_MIME_TYPES.has(mimeType)) {
            cb(null, true);
        } else {
            cb(new Error('INVALID_MIME_TYPE'));
        }
    }
});

export const parseVideoUpload = (req: Request, res: Response, next: NextFunction): Response | void  => {
    multipartVideoUpload.single('file')(req, res, (error) => {
        if (!error) {
            next();
        } else if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                message: 'Validation failed',
                data: { video: [`Video file too large. Max size: ${process.env.VIDEO_UPLOAD_LIMIT || DEFAULT_VIDEO_UPLOAD_LIMIT}`] }
            });
        } else if (error.message === 'INVALID_MIME_TYPE') {
            return res.status(422).json({
                message: 'Validation failed',
                data: { video: [`Unsupported video type. Allowed: ${Array.from(ALLOWED_VIDEO_MIME_TYPES).join(', ')}`] }
            });
        } else if (error instanceof MulterError) {
            return res.status(422).json({
                message: 'Validation failed',
                data: { file: ['Send multipart/form-data with a file field named "file"'] }
            });
        } else {
            console.error('Video upload parsing failed', error);
            return res.status(400).json({
                message: 'Validation failed',
                data: { file: ['Invalid multipart/form-data request'] }
            });
        }
    });
};

function getSizeLimitInBytes(rawLimitValue: string): number {
    const match = rawLimitValue.trim().toLowerCase().match(/^(\d+)(b|kb|mb|gb)?$/);
    if (!match) return 500 * 1024 * 1024;
    const size = Number(match[1]);
    const unit = match[2] || 'b';
    switch (unit) {
        case 'gb': return size * 1024 * 1024 * 1024;
        case 'mb': return size * 1024 * 1024;
        case 'kb': return size * 1024;
        default:   return size;
    }
}
