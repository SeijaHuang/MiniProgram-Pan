/**
 * Prisma Client Singleton
 * Ensures single PrismaClient instance across the application
 * Handles dev mode hot-reload to prevent multiple instances
 */

import { PrismaClient } from '@prisma/client';

// Extend global type for development hot-reload
declare global {
    // eslint-disable-next-line no-var
    var __prismaClient: PrismaClient | undefined;
}

/**
 * Creates or returns existing PrismaClient instance
 * In development, stores client in global to survive hot-reload
 */
function createPrismaClient(): PrismaClient {
    const client = new PrismaClient({
        log:
            process.env.NODE_ENV === 'development'
                ? ['query', 'error', 'warn']
                : ['error'],
    });

    return client;
}

// Use global in development to prevent multiple instances during hot-reload
export const prisma: PrismaClient =
    globalThis.__prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV === 'development') {
    globalThis.__prismaClient = prisma;
}

/**
 * Gracefully disconnect Prisma on shutdown
 */
export async function disconnectPrisma(): Promise<void> {
    await prisma.$disconnect();
}
