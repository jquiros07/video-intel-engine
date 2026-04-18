import { Request, Response, NextFunction, response } from 'express';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../utilities';
import { prisma } from '../db';

export const validateToken = (req: Request, res: Response, next: NextFunction): Response | void => {
    try {
        const authHeader = req.headers['authorization'];

        if (authHeader === undefined || authHeader === null) {
            return response.status(403).json({ message: 'Forbidden', data: null });
        }

        const token = authHeader && authHeader.split(' ')[1];

        if (token === null || token === '') {
            return response.status(403).json({ message: 'Forbidden', data: null });
        }

        const key = requireEnv('JWT_SECRET_KEY');
        const algorithm = requireEnv('JWT_ALGORITHM') as jwt.Algorithm;
        const options = { algorithms: [algorithm] } as jwt.VerifyOptions;

        jwt.verify(token, key, options, async (error) => {
            if (error) {
                return response.status(403).json({ 'message': 'Forbidden', 'data': null });
            } else {
                const existingToken = await prisma.access.findUnique({
                    where: { token: token }
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
        return response.status(403).json({ message: 'Forbidden', data: error });
    }
};
