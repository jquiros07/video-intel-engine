import { Request } from 'express';

export type AuthenticatedRequest = Request & {
    accessEmail?: string;
};
