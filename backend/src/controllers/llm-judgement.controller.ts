/**
 * LLM Judgement Controller
 * Handles HTTP requests for judgment verdict (判决书)
 *
 * ARCHITECTURE: Controller layer
 * - Validates request (Zod)
 * - Calls LlmJudgementService
 * - Maps result to HTTP status + JSON response
 * - Does NOT contain business logic
 */

import type { Request, Response } from 'express';

import {
    CreateJudgmentBodySchema,
    RoomIdParamSchema,
} from '../models/schemas/llm-request.schema';
import { llmJudgementService } from '../services/core/llm-judgement.service';
import type { IBaseResponse } from '../types/http';
import { EHttpErrorCode } from '../types/http';
import type { IJudgmentResponse } from '../types/llm';

export class LlmJudgementController {
    /**
     * Create judgment verdict (判决书)
     * POST /v1/rooms/:roomId/llm/judgment
     *
     * Status codes:
     * - 200: judgment verdict returned
     * - 400: invalid request body / params
     * - 502: LLM call failed
     */
    static async createJudgment(req: Request, res: Response): Promise<void> {
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
            const bodyResult = CreateJudgmentBodySchema.safeParse(req.body);
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
            const { player1Speech, player2Speech, idempotencyKey } =
                bodyResult.data;

            // Call service (synchronous LLM call)
            const result: IJudgmentResponse =
                await llmJudgementService.createJudgment(roomId, {
                    player1Speech,
                    player2Speech,
                    idempotencyKey,
                });

            const response: IBaseResponse<IJudgmentResponse> = {
                success: true,
                data: result,
            };
            res.status(200).json(response);
        } catch (error: unknown) {
            console.error(
                '[LlmJudgementController]' + ' createJudgment failed:',
                error instanceof Error ? error.message : String(error)
            );

            const response: IBaseResponse<never> = {
                success: false,
                error: {
                    code: EHttpErrorCode.LlmCallFailed,
                    message: 'LLM 判决服务暂时不可用，' + '请稍后重试',
                },
            };
            res.status(502).json(response);
        }
    }
}
