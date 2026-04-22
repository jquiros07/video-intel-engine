import { createHash } from 'crypto';

export const requireEnv = (name: string): string => {
    try {
        const value: string | undefined = process.env[name];
        if (!value) {
            throw new Error(`Missing environment variable: ${name}`);
        }
        return value;
    } catch (error) {
        throw new Error(`Missing environment variable: ${name}`);
    }
};

export const hashToken = (token: string): string => {
    return createHash('sha256').update(token).digest('hex');
};
