/**
 * LLM Judgement Worker
 * Standalone polling process that picks up queued tasks and runs LLM
 *
 * ARCHITECTURE: Worker process (separate from HTTP server)
 * - Polls llm_tasks for queued work
 * - Acquires room-level lock before calling LLM
 * - Calls OpenAI via clients/openai.client
 * - Writes back succeeded / failed status
 * - Graceful shutdown on SIGINT / SIGTERM
 *
 * Run: npm run worker:llm
 */

import { llmTaskRepository } from '../repositories/llm-task.repository';
import { roomLlmLockRepository } from '../repositories/room-llm-lock.repository';
import { createJudgement } from '../clients/openai.client';
import { LLM_WORKER_CONFIG } from '../constants/config';
import { disconnectPrisma } from '../database/prisma';
import type { ILlmTask } from '../types/llm';

/** Whether the worker should keep polling */
let running = true;

/** Whether a task is currently being processed */
let processing = false;

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format elapsed time for logging
 */
function elapsed(startMs: number): string {
    return `${Date.now() - startMs}ms`;
}

/**
 * Process a single claimed task:
 * 1. Acquire room lock
 * 2. Call OpenAI
 * 3. Mark succeeded / failed
 * 4. Release room lock
 */
async function processTask(task: ILlmTask): Promise<void> {
    const startMs = Date.now();
    const tag = `[Worker] task=${task.id} room=${task.roomId}`;
    let lockAcquired = false;

    try {
        console.log(`${tag} status=running`);

        // 1. Acquire room lock
        lockAcquired = await roomLlmLockRepository.tryAcquireRoomLock(
            task.roomId,
            task.id,
            LLM_WORKER_CONFIG.LOCK_TIMEOUT_MS
        );

        if (!lockAcquired) {
            // Room is busy — revert task to queued so it can be retried later
            console.warn(
                `${tag} room locked by another task, reverting to queued`
            );
            await llmTaskRepository.markFailed(
                task.id,
                'ROOM_LOCKED: 该房间有其他任务正在执行，请稍后重试'
            );
            return;
        }

        // 2. Call OpenAI
        console.log(`${tag} calling OpenAI...`);
        const result = await createJudgement(
            task.hostText,
            task.participantText
        );

        // 3. Mark succeeded
        await llmTaskRepository.markSucceeded(task.id, result);
        console.log(
            `${tag} status=succeeded verdict=${result.verdict} elapsed=${elapsed(startMs)}`
        );
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
            `${tag} status=failed error="${message}" elapsed=${elapsed(startMs)}`
        );

        try {
            await llmTaskRepository.markFailed(task.id, message);
        } catch (markErr: unknown) {
            console.error(
                `${tag} CRITICAL: failed to mark task as failed:`,
                markErr
            );
        }
    } finally {
        // 4. Release room lock (only if we acquired it)
        if (lockAcquired) {
            try {
                await roomLlmLockRepository.releaseRoomLock(
                    task.roomId,
                    task.id
                );
            } catch (releaseErr: unknown) {
                console.error(
                    `${tag} WARNING: failed to release room lock:`,
                    releaseErr
                );
            }
        }
    }
}

/**
 * Main polling loop
 */
async function pollLoop(): Promise<void> {
    console.log('[Worker] LLM Judgement Worker started');
    console.log(
        `[Worker] poll=${LLM_WORKER_CONFIG.POLL_INTERVAL_MS}ms ` +
            `lockTTL=${LLM_WORKER_CONFIG.LOCK_TIMEOUT_MS}ms`
    );

    while (running) {
        try {
            const task = await llmTaskRepository.claimNextQueuedTask();

            if (!task) {
                // Nothing to do — sleep and retry
                await sleep(LLM_WORKER_CONFIG.POLL_INTERVAL_MS);
                continue;
            }

            processing = true;
            await processTask(task);
            processing = false;
        } catch (error: unknown) {
            processing = false;
            console.error('[Worker] Unexpected poll error:', error);
            // Back off briefly to avoid tight error loops
            await sleep(LLM_WORKER_CONFIG.POLL_INTERVAL_MS * 2);
        }
    }

    console.log('[Worker] Poll loop exited');
}

/**
 * Graceful shutdown handler
 */
function handleShutdown(signal: string): void {
    console.log(`\n[Worker] ${signal} received — shutting down...`);
    running = false;

    if (!processing) {
        // Not processing, can exit immediately
        disconnectPrisma()
            .then(() => {
                console.log('[Worker] Prisma disconnected. Goodbye.');
                process.exit(0);
            })
            .catch((err: unknown) => {
                console.error('[Worker] Error disconnecting:', err);
                process.exit(1);
            });
    } else {
        console.log('[Worker] Waiting for current task to finish...');
        // The poll loop will exit after the current task completes,
        // then we disconnect and exit
        const checkInterval = setInterval(() => {
            if (!processing) {
                clearInterval(checkInterval);
                disconnectPrisma()
                    .then(() => {
                        console.log('[Worker] Prisma disconnected. Goodbye.');
                        process.exit(0);
                    })
                    .catch((err: unknown) => {
                        console.error('[Worker] Error disconnecting:', err);
                        process.exit(1);
                    });
            }
        }, 200);
    }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Start
pollLoop().catch((err: unknown) => {
    console.error('[Worker] Fatal error:', err);
    process.exit(1);
});
