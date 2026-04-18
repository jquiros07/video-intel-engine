import { PrismaClient } from './generated/prisma/client';

export const prisma = new PrismaClient({} as ConstructorParameters<typeof PrismaClient>[0]);
