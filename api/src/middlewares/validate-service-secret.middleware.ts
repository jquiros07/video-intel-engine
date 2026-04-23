import { Request, Response, NextFunction } from 'express';

export const validateServiceSecret = (req: Request, res: Response, next: NextFunction): void => {
    const secret = process.env.SERVICE_SECRET;
    if (!secret) {
        res.status(500).json({ message: 'Service secret not configured', data: null });
        return;
    }
    if (req.headers['x-service-secret'] !== secret) {
        res.status(401).json({ message: 'Unauthorized', data: null });
        return;
    }
    next();
};
