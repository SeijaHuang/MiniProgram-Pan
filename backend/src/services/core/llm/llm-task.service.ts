/**
 * LLM Task Service
 * Business logic for LLM task management
 *
 * ARCHITECTURE: Core Business Service
 * - Handles task creation with idempotency
 * - Queries task status
 * - Does NOT call LLM directly (Worker responsibility)
 */

import { prisma } from '../../../database/prisma';
import type { LlmTask } from '@prisma/client';
import type {
    ICreateJudgementRequest,
    ILlmTask,
    ELlmTaskStatus,
} from '../../../types/llm';

/**
 * Map Prisma LlmTask to ILlmTask interface
 */
function mapPrismaTaskToInterface(task: LlmTask): ILlmTask {
    return {
        id: task.id,
        roomId: task.roomId,
        idempotencyKey: task.idempotencyKey,
        status: task.status as ELlmTaskStatus,
        hostText: task.hostText,
        participantText: task.participantText,
        resultJson: task.resultJson as ILlmTask['resultJson'],
        errorMessage: task.errorMessage,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
    };
}

export class LlmTaskService {
    /**
     * Create a new LLM judgement task with idempotency
     *
     * If a task with the same idempotencyKey already exists,
     * return the existing task instead of creating a new one.
     *
     * @param roomId - The room ID
     * @param request - The judgement request containing hostText, participantText, idempotencyKey
     * @returns The created or existing task
     */
    async createTask(
        roomId: string,
        request: ICreateJudgementRequest
    ): Promise<ILlmTask> {
        const { hostText, participantText, idempotencyKey } = request;

        // Check for existing task with same idempotency key
        const existingTask = await prisma.llmTask.findUnique({
            where: { idempotencyKey },
        });

        if (existingTask) {
            console.log(
                `[LlmTaskService] Returning existing task for idempotencyKey: ${idempotencyKey}`
            );
            return mapPrismaTaskToInterface(existingTask);
        }

        // Create new task with status = queued
        const newTask = await prisma.llmTask.create({
            data: {
                roomId,
                idempotencyKey,
                hostText,
                participantText,
                status: 'queued',
            },
        });

        console.log(
            `[LlmTaskService] Created new task: ${newTask.id} for room: ${roomId}`
        );

        return mapPrismaTaskToInterface(newTask);
    }

    /**
     * Get a task by ID
     *
     * @param taskId - The task ID (UUID)
     * @returns The task or null if not found
     */
    async getTask(taskId: string): Promise<ILlmTask | null> {
        const task = await prisma.llmTask.findUnique({
            where: { id: taskId },
        });

        if (!task) {
            return null;
        }

        return mapPrismaTaskToInterface(task);
    }

    /**
     * Get all tasks for a room
     *
     * @param roomId - The room ID
     * @returns Array of tasks for the room
     */
    async getTasksByRoom(roomId: string): Promise<ILlmTask[]> {
        const tasks = await prisma.llmTask.findMany({
            where: { roomId },
            orderBy: { createdAt: 'desc' },
        });

        return tasks.map(mapPrismaTaskToInterface);
    }
}

// Singleton instance
export const llmTaskService = new LlmTaskService();
