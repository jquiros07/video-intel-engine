import { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';

const DEFAULT_VIDEO_UPLOAD_PARSER_LIMIT = '1gb';

const multipartVideoUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: getSizeLimitInBytes(process.env.VIDEO_UPLOAD_PARSER_LIMIT || DEFAULT_VIDEO_UPLOAD_PARSER_LIMIT)
    }
});

export const parseVideoUpload = (req: Request, res: Response, next: NextFunction): void => {
    multipartVideoUpload.single('file')(req, res, (error) => {
        if (!error) {
            next();
            return;
        }

        if (error instanceof MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                res.status(413).json({
                    message: 'Validation failed',
                    data: {
                        video: [`Video file is too large. Parser max size is ${process.env.VIDEO_UPLOAD_PARSER_LIMIT || DEFAULT_VIDEO_UPLOAD_PARSER_LIMIT}`]
                    }
                });
                return;
            }

            res.status(422).json({
                message: 'Validation failed',
                data: {
                    file: ['Send multipart/form-data with a file field named "file"']
                }
            });
            return;
        }

        console.error('Video upload parsing failed', error);
        res.status(400).json({
            message: 'Validation failed',
            data: {
                file: ['Invalid multipart/form-data request']
            }
        });
    });
};

function getSizeLimitInBytes(rawLimitValue: string): number {
    const rawLimit = rawLimitValue.trim().toLowerCase();
    const match = rawLimit.match(/^(\d+)(b|kb|mb|gb)?$/);

    if (!match) {
        return 1024 * 1024 * 1024;
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
}
