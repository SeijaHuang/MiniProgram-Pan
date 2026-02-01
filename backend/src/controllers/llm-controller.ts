/**
 * LLM Controller
 * Handles HTTP requests for LLM judgement tasks
 *
 * ARCHITECTURE: Controller layer
 * - Validates HTTP request
 * - Calls business logic (service layer)
 * - Formats HTTP response
 * - Does NOT contain business logic
 * - Does NOT call LLM directly (Worker responsibility)
 */

import type { Request, Response } from 'express';
import type { IBaseResponse } from '../types/http';
import { EHttpErrorCode } from '../types/http';
import { llmTaskService } from '../services/core/llm/llm-task.service';
import {
    CreateJudgementBodySchema,
    RoomIdParamSchema,
    TaskIdParamSchema,
} from '../models/schemas/llm-request.schema';
import type {
    ICreateJudgementResponseData,
    IGetTaskResponseData,
    ELlmTaskStatus,
} from '../types/llm';

export class LlmController {
    /**
     * Create a new LLM judgement task
     * POST /v1/rooms/:roomId/llm/judgement
     *
     * Idempotent: Same idempotencyKey returns same taskId
     */
    static async createJudgementTask(
        req: Request,
        res: Response
    ): Promise<void> {
        try {
            // Validate path parameters
            const paramValidation = RoomIdParamSchema.safeParse(req.params);
            if (!paramValidation.success) {
                const errors = paramValidation.error.issues;
                const errorMessage = errors[0]?.message ?? '房间ID无效';
                const response: IBaseResponse<never> = {
                    success: false,
                    error: {
                        code: EHttpErrorCode.InvalidRequest,
                        message: errorMessage,
                    },
                };
                res.status(400).json(response);
                return;
            }

            // Validate request body
            const bodyValidation = CreateJudgementBodySchema.safeParse(
                req.body
            );
            if (!bodyValidation.success) {
                const errors = bodyValidation.error.issues;
                const errorMessage = errors[0]?.message ?? '请求参数无效';
                const response: IBaseResponse<never> = {
                    success: false,
                    error: {
                        code: EHttpErrorCode.InvalidRequest,
                        message: errorMessage,
                    },
                };
                res.status(400).json(response);
                return;
            }

            const { roomId } = paramValidation.data;
            const { hostText, participantText, idempotencyKey } =
                bodyValidation.data;

            // Create task (idempotent)
            const task = await llmTaskService.createTask(roomId, {
                hostText,
                participantText,
                idempotencyKey,
            });

            const response: IBaseResponse<ICreateJudgementResponseData> = {
                success: true,
                data: {
                    taskId: task.id,
                    status: task.status as ELlmTaskStatus,
                },
            };

            // 201 for new creation, but since this is idempotent,
            // we always return 200 (the task may already exist)
            res.status(200).json(response);
        } catch (error: unknown) {
            console.error(
                '[LlmController] Create judgement task failed:',
                error
            );

            const errorMessage =
                error instanceof Error ? error.message : '创建任务失败';
            const response: IBaseResponse<never> = {
                success: false,
                error: {
                    code: EHttpErrorCode.TaskCreateFailed,
                    message: errorMessage,
                },
            };

            res.status(500).json(response);
        }
    }

    /**
     * Get task status and result
     * GET /v1/llm/tasks/:taskId
     */
    static async getTask(req: Request, res: Response): Promise<void> {
        try {
            // Validate path parameters
            const paramValidation = TaskIdParamSchema.safeParse(req.params);
            if (!paramValidation.success) {
                const errors = paramValidation.error.issues;
                const errorMessage = errors[0]?.message ?? '任务ID无效';
                const response: IBaseResponse<never> = {
                    success: false,
                    error: {
                        code: EHttpErrorCode.InvalidRequest,
                        message: errorMessage,
                    },
                };
                res.status(400).json(response);
                return;
            }

            const { taskId } = paramValidation.data;

            // Get task
            const task = await llmTaskService.getTask(taskId);

            if (!task) {
                const response: IBaseResponse<never> = {
                    success: false,
                    error: {
                        code: EHttpErrorCode.TaskNotFound,
                        message: '任务不存在',
                    },
                };
                res.status(404).json(response);
                return;
            }

            const response: IBaseResponse<IGetTaskResponseData> = {
                success: true,
                data: {
                    taskId: task.id,
                    status: task.status as ELlmTaskStatus,
                    resultJson: task.resultJson,
                    errorMessage: task.errorMessage,
                    createdAt: task.createdAt.toISOString(),
                    startedAt: task.startedAt?.toISOString() ?? null,
                    finishedAt: task.finishedAt?.toISOString() ?? null,
                },
            };

            res.status(200).json(response);
        } catch (error: unknown) {
            console.error('[LlmController] Get task failed:', error);

            const errorMessage =
                error instanceof Error ? error.message : '获取任务失败';
            const response: IBaseResponse<never> = {
                success: false,
                error: {
                    code: EHttpErrorCode.InternalError,
                    message: errorMessage,
                },
            };

            res.status(500).json(response);
        }
    }
}
