/**
 * LLM Judgement Controller
 * Handles HTTP requests for LLM judgement tasks
 *
 * ARCHITECTURE: Controller layer
 * - Validates request (Zod)
 * - Calls LlmJudgementService
 * - Maps result to HTTP status + JSON response
 * - Does NOT contain business logic
 */

import type { Request, Response } from 'express';

import {
    CreateJudgementBodySchema,
    RoomIdParamSchema,
    TaskIdParamSchema,
} from '../models/schemas/llm-request.schema';
import {
    llmJudgementService,
    TCreateJudgementResult,
    TGetTaskResult,
} from '../services/core/llm-judgement.service';
import type { IBaseResponse } from '../types/http';
import { EHttpErrorCode } from '../types/http';
import type {
    ICreateJudgementResponseData,
    IGetTaskResponseData,
    ELlmTaskStatus,
} from '../types/llm';

/**
 * Map EHttpErrorCode to HTTP status code
 */
function errorCodeToStatus(code: EHttpErrorCode): number {
    switch (code) {
        case EHttpErrorCode.RoomNotFound:
        case EHttpErrorCode.TaskNotFound:
            return 404;
        case EHttpErrorCode.InvalidRequest:
            return 400;
        default:
            return 500;
    }
}

export class LlmJudgementController {
    /**
     * Create a new LLM judgement task
     * POST /v1/rooms/:roomId/llm/judgement
     *
     * Idempotent: same idempotencyKey returns same taskId
     *
     * Status codes:
     * - 200: task returned (existing or new)
     * - 400: invalid request body / params
     * - 404: room not found
     * - 500: internal error
     */
    static async createJudgementTask(
        req: Request,
        res: Response
    ): Promise<void> {
        try {
            // Validate path params
            const paramResult = RoomIdParamSchema.safeParse(req.params);
            if (!paramResult.success) {
                const message =
                    paramResult.error.issues[0]?.message ?? '房间ID无效';
                const response: IBaseResponse<never> = {
                    success: false,
                    error: {
                        code: EHttpErrorCode.InvalidRequest,
                        message,
                    },
                };
                res.status(400).json(response);
                return;
            }

            // Validate body
            const bodyResult = CreateJudgementBodySchema.safeParse(req.body);
            if (!bodyResult.success) {
                const message =
                    bodyResult.error.issues[0]?.message ?? '请求参数无效';
                const response: IBaseResponse<never> = {
                    success: false,
                    error: {
                        code: EHttpErrorCode.InvalidRequest,
                        message,
                    },
                };
                res.status(400).json(response);
                return;
            }

            const { roomId } = paramResult.data;
            const { hostText, participantText, idempotencyKey } =
                bodyResult.data;

            // Call service
            const result: TCreateJudgementResult =
                await llmJudgementService.createJudgementTask(roomId, {
                    hostText,
                    participantText,
                    idempotencyKey,
                });

            if (!result.success) {
                const response: IBaseResponse<never> = {
                    success: false,
                    error: {
                        code: result.code,
                        message: result.message,
                    },
                };
                res.status(errorCodeToStatus(result.code)).json(response);
                return;
            }

            const response: IBaseResponse<ICreateJudgementResponseData> = {
                success: true,
                data: {
                    taskId: result.task.id,
                    status: result.task.status as ELlmTaskStatus,
                },
            };
            res.status(200).json(response);
        } catch (error: unknown) {
            console.error(
                '[LlmJudgementController] createJudgementTask failed:',
                error
            );
            const message =
                error instanceof Error ? error.message : '创建任务失败';
            const response: IBaseResponse<never> = {
                success: false,
                error: {
                    code: EHttpErrorCode.TaskCreateFailed,
                    message,
                },
            };
            res.status(500).json(response);
        }
    }

    /**
     * Get task status and result
     * GET /v1/llm/tasks/:taskId
     *
     * Status codes:
     * - 200: task found
     * - 400: invalid taskId format
     * - 404: task not found
     * - 500: internal error
     */
    static async getTask(req: Request, res: Response): Promise<void> {
        try {
            // Validate path params
            const paramResult = TaskIdParamSchema.safeParse(req.params);
            if (!paramResult.success) {
                const message =
                    paramResult.error.issues[0]?.message ?? '任务ID无效';
                const response: IBaseResponse<never> = {
                    success: false,
                    error: {
                        code: EHttpErrorCode.InvalidRequest,
                        message,
                    },
                };
                res.status(400).json(response);
                return;
            }

            const { taskId } = paramResult.data;

            // Call service
            const result: TGetTaskResult =
                await llmJudgementService.getTask(taskId);

            if (!result.success) {
                const response: IBaseResponse<never> = {
                    success: false,
                    error: {
                        code: result.code,
                        message: result.message,
                    },
                };
                res.status(errorCodeToStatus(result.code)).json(response);
                return;
            }

            const { task } = result;
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
            console.error('[LlmJudgementController] getTask failed:', error);
            const message =
                error instanceof Error ? error.message : '获取任务失败';
            const response: IBaseResponse<never> = {
                success: false,
                error: {
                    code: EHttpErrorCode.InternalError,
                    message,
                },
            };
            res.status(500).json(response);
        }
    }
}
