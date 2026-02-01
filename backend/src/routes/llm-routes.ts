/**
 * LLM Routes
 * Defines HTTP routes for LLM judgement operations
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
import { LlmController } from '../controllers/llm-controller';

const router = Router();

/**
 * Create judgement task endpoint
 * POST /v1/rooms/:roomId/llm/judgement
 *
 * Idempotent: Same idempotencyKey returns same taskId
 */
router.post(
    '/rooms/:roomId/llm/judgement',
    LlmController.createJudgementTask.bind(LlmController)
);

/**
 * Get task status endpoint
 * GET /v1/llm/tasks/:taskId
 */
router.get('/llm/tasks/:taskId', LlmController.getTask.bind(LlmController));

export default router;
