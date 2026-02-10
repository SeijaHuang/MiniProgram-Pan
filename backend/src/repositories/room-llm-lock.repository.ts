/**
 * Room LLM Lock Repository
 * Data access layer for room-level LLM task locking
 *
 * ARCHITECTURE: Repository Layer
 * - Manages room_llm_locks table for mutual exclusion
 * - Ensures only one LLM task per room runs at a time
 * - Uses upsert with conditional checks for atomic lock acquisition
 * - All queries are parameterized (Prisma handles this)
 */

import { prisma } from '../database/prisma';

export class RoomLlmLockRepository {
    /**
     * Try to acquire a room-level lock for a task
     *
     * Upserts a lock row: succeeds if the lock does not exist
     * or if the existing lock has expired (lockedUntil < now).
     * On conflict (row exists & not expired), returns false.
     *
     * Uses raw SQL for atomic upsert with expiry check.
     *
     * @param roomId  - The room to lock
     * @param taskId  - The task acquiring the lock
     * @param ttlMs   - Lock time-to-live in milliseconds
     * @returns true if lock was acquired, false otherwise
     */
    async tryAcquireRoomLock(
        roomId: string,
        taskId: string,
        ttlMs: number
    ): Promise<boolean> {
        // Calculate lock expiry from now
        const lockedUntil = new Date(Date.now() + ttlMs);

        // Atomic upsert: insert if not exists, or update if expired
        // The WHERE on conflict ensures we only overwrite expired locks
        const result = await prisma.$executeRaw`
            INSERT INTO "room_llm_locks" (
                "roomId", "lockedTaskId", "lockedUntil", "updatedAt"
            )
            VALUES (
                ${roomId}, ${taskId}, ${lockedUntil}, NOW()
            )
            ON CONFLICT ("roomId") DO UPDATE
            SET
                "lockedTaskId" = ${taskId},
                "lockedUntil"  = ${lockedUntil},
                "updatedAt"    = NOW()
            WHERE "room_llm_locks"."lockedUntil" < NOW()
        `;

        // result = number of rows affected
        // 1 means lock acquired (insert or update), 0 means blocked
        return result === 1;
    }

    /**
     * Release a room-level lock
     *
     * Only releases if the lock is currently held by the given taskId.
     * Prevents one task from releasing another task's lock.
     *
     * @param roomId - The room to unlock
     * @param taskId - The task releasing the lock (must match lockedTaskId)
     * @returns true if lock was released, false if not held by this task
     */
    async releaseRoomLock(roomId: string, taskId: string): Promise<boolean> {
        const result = await prisma.$executeRaw`
            DELETE FROM "room_llm_locks"
            WHERE "roomId" = ${roomId}
              AND "lockedTaskId" = ${taskId}
        `;

        // 1 = deleted (released), 0 = not held by this task
        return result === 1;
    }
}

// Singleton instance
export const roomLlmLockRepository = new RoomLlmLockRepository();
