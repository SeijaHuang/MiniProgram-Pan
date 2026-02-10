/**
 * LLM Judgement Service
 * Business logic for LLM judgement task lifecycle
 *
 * ARCHITECTURE: Core Business Service
 * - Idempotent task creation (deduplicate by idempotencyKey)
 * - Optional room existence validation via RoomManager
 * - Delegates all data access to LlmTaskRepository
 * - Does NOT call LLM directly (Worker responsibility)
 */

import { llmTaskRepository } from '../../repositories/llm-task.repository';
import { roomManager } from '../websocket/room-manager';
import { EHttpErrorCode } from '../../types/http';
import type { ICreateJudgementRequest, ILlmTask } from '../../types/llm';

/**
 * Result type for createJudgementTask
 * Uses discriminated union so the controller can decide HTTP status
 */
export type TCreateJudgementResult =
    | { success: true; task: ILlmTask; created: boolean }
    | { success: false; code: EHttpErrorCode; message: string };

/**
 * Result type for getTask
 */
export type TGetTaskResult =
    | { success: true; task: ILlmTask }
    | { success: false; code: EHttpErrorCode; message: string };

export class LlmJudgementService {
    /**
     * Create a new LLM judgement task (idempotent)
     *
     * 1. Validate room exists (optional, graceful)
     * 2. Check idempotencyKey for existing task → return if found
     * 3. Otherwise create a new queued task
     *
     * @param roomId  - The room requesting judgement
     * @param payload - hostText, participantText, idempotencyKey
     * @returns Discriminated union: success with task, or failure with code
     */
    async createJudgementTask(
        roomId: string,
        payload: ICreateJudgementRequest
    ): Promise<TCreateJudgementResult> {
        // Optional room existence check via in-memory RoomManager
        const room = roomManager.getRoomById(roomId);
        if (!room) {
            console.warn(`[LlmJudgementService] Room not found: ${roomId}`);
            return {
                success: false,
                code: EHttpErrorCode.RoomNotFound,
                message: '房间不存在',
            };
        }

        // Idempotency: check if task already exists
        const existing = await llmTaskRepository.findByIdempotencyKey(
            payload.idempotencyKey
        );
        if (existing) {
            console.log(
                `[LlmJudgementService] Idempotent hit: ` +
                    `key=${payload.idempotencyKey}, taskId=${existing.id}`
            );
            return { success: true, task: existing, created: false };
        }

        // Create new queued task
        const task = await llmTaskRepository.createQueuedTask(roomId, payload);
        console.log(
            `[LlmJudgementService] Task created: ${task.id} ` +
                `for room ${roomId}`
        );

        return { success: true, task, created: true };
    }

    /**
     * Get a task by ID
     *
     * @param taskId - UUID of the task
     * @returns Discriminated union: success with task, or 404
     */
    async getTask(taskId: string): Promise<TGetTaskResult> {
        const task = await llmTaskRepository.getTaskById(taskId);

        if (!task) {
            return {
                success: false,
                code: EHttpErrorCode.TaskNotFound,
                message: '任务不存在',
            };
        }

        return { success: true, task };
    }
}

// Singleton instance
export const llmJudgementService = new LlmJudgementService();
