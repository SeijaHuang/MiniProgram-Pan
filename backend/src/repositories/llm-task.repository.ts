/**
 * LLM Task Repository
 * Data access layer for LLM task operations
 *
 * ARCHITECTURE: Repository Layer
 * - All SQL / Prisma queries for llm_tasks live here
 * - Service layer calls repository, never Prisma directly
 * - All queries are parameterized (Prisma handles this)
 */

import type { LlmTask } from '@prisma/client';

import { prisma } from '../database/prisma';
import type { ICreateJudgementRequest, ILlmTask } from '../types/llm';

/**
 * Map Prisma LlmTask row to domain ILlmTask interface
 */
function toDomain(task: LlmTask): ILlmTask {
    return {
        id: task.id,
        roomId: task.roomId,
        idempotencyKey: task.idempotencyKey,
        status: task.status as ILlmTask['status'],
        hostText: task.hostText,
        participantText: task.participantText,
        resultJson: task.resultJson as ILlmTask['resultJson'],
        errorMessage: task.errorMessage,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
    };
}

export class LlmTaskRepository {
    /**
     * Find a task by its idempotency key
     * Used to deduplicate creation requests
     */
    async findByIdempotencyKey(
        idempotencyKey: string
    ): Promise<ILlmTask | null> {
        const task = await prisma.llmTask.findUnique({
            where: { idempotencyKey },
        });
        return task ? toDomain(task) : null;
    }

    /**
     * Create a new queued task
     * Status defaults to 'queued', startedAt/finishedAt are null
     */
    async createQueuedTask(
        roomId: string,
        request: ICreateJudgementRequest
    ): Promise<ILlmTask> {
        const task = await prisma.llmTask.create({
            data: {
                roomId,
                idempotencyKey: request.idempotencyKey,
                hostText: request.hostText,
                participantText: request.participantText,
                status: 'queued',
            },
        });
        return toDomain(task);
    }

    /**
     * Get a task by its primary key (UUID)
     */
    async getTaskById(taskId: string): Promise<ILlmTask | null> {
        const task = await prisma.llmTask.findUnique({
            where: { id: taskId },
        });
        return task ? toDomain(task) : null;
    }

    /**
     * Claim the next queued task using a transaction
     *
     * Uses raw SQL with SELECT ... FOR UPDATE SKIP LOCKED
     * to atomically grab one queued task and mark it as running.
     * Safe for concurrent workers.
     *
     * @returns The claimed task (now status=running), or null if none available
     */
    async claimNextQueuedTask(): Promise<ILlmTask | null> {
        const result = await prisma.$transaction(async tx => {
            // SELECT ... FOR UPDATE SKIP LOCKED: grab one queued row,
            // skip any already locked by another transaction
            const rows = await tx.$queryRaw<LlmTask[]>`
                SELECT *
                FROM "llm_tasks"
                WHERE "status" = 'queued'
                ORDER BY "createdAt" ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            `;

            if (rows.length === 0) {
                return null;
            }

            const row = rows[0];

            // Atomically update to running
            const updated = await tx.llmTask.update({
                where: { id: row.id },
                data: {
                    status: 'running',
                    startedAt: new Date(),
                },
            });

            return updated;
        });

        return result ? toDomain(result) : null;
    }

    /**
     * Mark a task as succeeded with result JSON
     */
    async markSucceeded(
        taskId: string,
        resultJson: ILlmTask['resultJson']
    ): Promise<ILlmTask> {
        const task = await prisma.llmTask.update({
            where: { id: taskId },
            data: {
                status: 'succeeded',
                resultJson: resultJson as object,
                finishedAt: new Date(),
            },
        });
        return toDomain(task);
    }

    /**
     * Mark a task as failed with an error message
     */
    async markFailed(taskId: string, errorMessage: string): Promise<ILlmTask> {
        const task = await prisma.llmTask.update({
            where: { id: taskId },
            data: {
                status: 'failed',
                errorMessage,
                finishedAt: new Date(),
            },
        });
        return toDomain(task);
    }
}

// Singleton instance
export const llmTaskRepository = new LlmTaskRepository();
