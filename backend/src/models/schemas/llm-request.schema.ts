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
 * Create Judgement Request Body Schema
 * POST /v1/rooms/:roomId/llm/judgement
 */
export const CreateJudgementBodySchema = z.object({
    hostText: z
        .string()
        .min(1, '主持人文本不能为空')
        .max(8000, '主持人文本过长'),
    participantText: z
        .string()
        .min(1, '参与者文本不能为空')
        .max(8000, '参与者文本过长'),
});

/**
 * Room ID Path Parameter Schema
 */
export const RoomIdParamSchema = z.object({
    roomId: z.string().min(1, '房间ID不能为空'),
});

/**
 * Type inference from schemas
 */
export type TCreateJudgementBody = z.infer<typeof CreateJudgementBodySchema>;
export type TRoomIdParam = z.infer<typeof RoomIdParamSchema>;
