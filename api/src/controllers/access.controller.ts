import { Request, Response } from 'express';
import { hashToken, requireEnv } from '../utilities';
import jwt from 'jsonwebtoken';
import { RequestAccess } from '../types/RequestAccess';
import Validator from 'validatorjs';
import { prisma } from '../db';

export const requestAccessToken = async (req: Request, res: Response): Promise<Response> => {
    try {
        const validationRules = {
            email: 'string|required|email'
        };

        const body = req.body;
        const validator: Validator.Validator<RequestAccess> = new Validator(body, validationRules);

        if (validator.fails()) {
            return res.status(422).json({ message: 'Validation failed', data: validator.errors.all() });
        }

        const token = generateToken(body);

        // Parse JWT_EXPIRATION (in minutes) to calculate expiration for DB
        const expStr = requireEnv('JWT_EXPIRATION');
        const minutes = parseInt(expStr, 10) || 60;
        const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

        await prisma.access.create({
            data: {
                token: hashToken(token),
                userId: body.email,
                expiresAt: expiresAt
            }
        });

        return res.status(200).json({ message: 'Request granted', data: { token } });
    } catch (error) {
        console.error('Error during access token request', error);
        return res.status(500).json({ message: 'Internal server error', data: null });
    }
};

const generateToken = (payload: RequestAccess): string => {
    const key: string = requireEnv('JWT_SECRET_KEY');
    const options: jwt.SignOptions = {
        algorithm: requireEnv('JWT_ALGORITHM') as jwt.Algorithm,
        expiresIn: parseInt(requireEnv('JWT_EXPIRATION'), 10) * 60 // Converting minutes to seconds for jsonwebtoken
    };

    return jwt.sign(payload, key, options);
};
