/**
 * LLM Judgement Routes
 * HTTP route definitions for judgment verdict (判决书)
 *
 * ARCHITECTURE: Route definition layer
 * - Defines URL paths and HTTP methods
 * - Maps routes to controller methods
 * - Does NOT contain logic
 *
 * Routes:
 * - POST /v1/rooms/:roomId/judgments
 */

import { Router } from 'express';

import { LlmJudgementController } from '../controllers/llm-judgement.controller';

const router = Router();

/**
 * Create judgment verdict (判决书)
 * POST /v1/rooms/:roomId/judgments
 */
router.post(
    '/:roomId/judgments',
    LlmJudgementController.createJudgment.bind(LlmJudgementController)
);

export default router;
