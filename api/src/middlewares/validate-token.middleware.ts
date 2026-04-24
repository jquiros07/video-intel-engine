import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { hashToken, requireEnv } from '../helpers/utilities';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../types/AuthenticatedRequest';

type AccessTokenPayload = jwt.JwtPayload & {
    email?: string;
};

export const validateToken = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
        const authenticatedRequest = req as AuthenticatedRequest;
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            req.resume();
            return res.status(403).json({ message: 'Forbidden', data: null });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            req.resume();
            return res.status(403).json({ message: 'Forbidden', data: null });
        }

        const key = requireEnv('JWT_SECRET_KEY');
        const algorithm = requireEnv('JWT_ALGORITHM') as jwt.Algorithm;
        const decodedToken = jwt.verify(token, key, { algorithms: [algorithm] }) as AccessTokenPayload | string;

        if (typeof decodedToken === 'string' || !decodedToken.email) {
            req.resume();
            return res.status(403).json({ message: 'Forbidden', data: null });
        }

        const existingToken = await prisma.access.findUnique({
            where: { token: hashToken(token) }
        });

        if (!existingToken) {
            req.resume();
            return res.status(403).json({ message: 'Forbidden: Invalid token', data: null });
        }

        if (existingToken.expiresAt < new Date()) {
            req.resume();
            return res.status(403).json({ message: 'Forbidden: Token expired', data: null });
        }

        authenticatedRequest.accessEmail = decodedToken.email;
        next();
    } catch (error) {
        req.resume();
        return res.status(403).json({ message: 'Forbidden', data: null });
    }
};
