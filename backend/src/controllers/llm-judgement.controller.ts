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
import { roomManager } from '../services/websocket/room-manager';
import type { IBaseResponse } from '../types/http';
import { EHttpErrorCode } from '../types/http';
import type { IJudgmentResponse } from '../types/llm';
import { logger } from '../utils/logger';

export class LlmJudgementController {
    /**
     * Create judgment verdict (判决书)
     * POST /v1/rooms/:roomId/judgments
     *
     * Status codes:
     * - 200: judgment verdict returned
     * - 400: invalid request body / params
     * - 502: LLM call failed
     */
    static async createJudgment(req: Request, res: Response): Promise<void> {
        let llmRoomId: string | undefined;
        let llmStartMs = 0;
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
            const { idempotencyKey } = bodyResult.data;
            llmRoomId = roomId;

            // Look up room to get participant identity and accumulated speech
            const room = roomManager.getRoomById(roomId);
            if (!room || room.participants.length < 2) {
                const response: IBaseResponse<never> = {
                    success: false,
                    error: {
                        code: EHttpErrorCode.InvalidRequest,
                        message: '房间不存在或参与者不足',
                    },
                };
                res.status(400).json(response);
                return;
            }

            const [p1, p2] = room.participants;
            const texts = room.speechState?.texts ?? {};

            // Call service (synchronous LLM call)
            llmStartMs = Date.now();
            logger.info('llm.judgment.start', { roomId });
            const result: IJudgmentResponse =
                await llmJudgementService.createJudgment(roomId, {
                    player1: {
                        userId: p1.user.userId,
                        nickname: p1.user.nickname,
                        speech:
                            (texts[p1.user.userId] ?? '').trim() ||
                            '（无发言）',
                    },
                    player2: {
                        userId: p2.user.userId,
                        nickname: p2.user.nickname,
                        speech:
                            (texts[p2.user.userId] ?? '').trim() ||
                            '（无发言）',
                    },
                    idempotencyKey,
                });

            const response: IBaseResponse<IJudgmentResponse> = {
                success: true,
                data: result,
            };
            logger.info('llm.judgment.ok', {
                roomId: llmRoomId,
                durationMs: Date.now() - llmStartMs,
            });
            res.status(200).json(response);
        } catch (error: unknown) {
            logger.error(
                'LlmController',
                'createJudgment failed:',
                error instanceof Error ? error.message : String(error)
            );
            logger.error('llm.judgment.failed', {
                roomId: llmRoomId,
                durationMs: Date.now() - llmStartMs,
                error: error instanceof Error ? error.message : String(error),
            });

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
