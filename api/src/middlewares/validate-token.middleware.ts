import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { hashToken, requireEnv } from '../helpers/utilities';
import { prisma } from '../db';

export const validateToken = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(403).json({ message: 'Forbidden', data: null });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(403).json({ message: 'Forbidden', data: null });
        }

        const key = requireEnv('JWT_SECRET_KEY');
        const algorithm = requireEnv('JWT_ALGORITHM') as jwt.Algorithm;
        jwt.verify(token, key, { algorithms: [algorithm] }, async (err) => {
            if (err) {
                return res.status(403).json({ message: 'Forbidden', data: null });
            } else {
                const existingToken = await prisma.access.findUnique({
                    where: { token: hashToken(token) }
                });

                if (!existingToken) {
                    return res.status(403).json({ message: 'Forbidden: Invalid token', data: null });
                }

                if (existingToken.expiresAt < new Date()) {
                    return res.status(403).json({ message: 'Forbidden: Token expired', data: null });
                }

                next();
            }
        });
    } catch (error) {
        return res.status(403).json({ message: 'Forbidden', data: error });
    }
};
