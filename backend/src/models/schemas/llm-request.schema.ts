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
 * POST /v1/rooms/:roomId/judgments
 * Speech texts are read from room state, not passed in the body.
 */
export const CreateJudgmentBodySchema = z.object({
    idempotencyKey: z.string().max(128).optional(),
});

/**
 * Type inference from schemas
 */
export type TCreateJudgmentBody = z.infer<typeof CreateJudgmentBodySchema>;
export type TRoomIdParam = z.infer<typeof RoomIdParamSchema>;
