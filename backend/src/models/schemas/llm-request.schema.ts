/**
 * LLM Request Validation Schemas
 * Zod schemas for runtime validation of LLM-related HTTP requests
 *
 * ARCHITECTURE: Validation Layer
 * - Runtime validation using Zod
 * - Type inference from schemas
 * - Clear error messages
 */

import { z } from 'zod';

/**
 * Room ID Path Parameter Schema
 */
export const RoomIdParamSchema = z.object({
    roomId: z.string().min(1, '房间ID不能为空'),
});

/**
 * Create Judgment Verdict Request Body Schema
 * POST /v1/rooms/:roomId/llm/judgment
 */
export const CreateJudgmentBodySchema = z.object({
    player1Speech: z
        .string()
        .min(1, '玩家1陈述不能为空')
        .max(8000, '玩家1陈述过长'),
    player2Speech: z
        .string()
        .min(1, '玩家2陈述不能为空')
        .max(8000, '玩家2陈述过长'),
    idempotencyKey: z.string().max(128).optional(),
});

/**
 * Type inference from schemas
 */
export type TCreateJudgmentBody = z.infer<typeof CreateJudgmentBodySchema>;
export type TRoomIdParam = z.infer<typeof RoomIdParamSchema>;
