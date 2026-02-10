/**
 * LLM Judgement Routes
 * HTTP route definitions for LLM judgement operations
 *
 * ARCHITECTURE: Route definition layer
 * - Defines URL paths and HTTP methods
 * - Maps routes to controller methods
 * - Does NOT contain logic
 *
 * Routes:
 * - POST /v1/rooms/:roomId/llm/judgement - Create judgement task
 * - GET  /v1/llm/tasks/:taskId           - Get task status/result
 */

import { Router } from 'express';

import { LlmJudgementController } from '../controllers/llm-judgement.controller';

const router = Router();

/**
 * Create judgement task
 * POST /v1/rooms/:roomId/llm/judgement
 *
 * Idempotent: same idempotencyKey returns same taskId
 */
router.post(
    '/rooms/:roomId/llm/judgement',
    LlmJudgementController.createJudgementTask.bind(LlmJudgementController)
);

/**
 * Get task status / result
 * GET /v1/llm/tasks/:taskId
 */
router.get(
    '/llm/tasks/:taskId',
    LlmJudgementController.getTask.bind(LlmJudgementController)
);

export default router;
