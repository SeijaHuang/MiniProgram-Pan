/**
 * LLM Judgement Routes
 * HTTP route definitions for synchronous LLM judgement
 *
 * ARCHITECTURE: Route definition layer
 * - Defines URL paths and HTTP methods
 * - Maps routes to controller methods
 * - Does NOT contain logic
 *
 * Routes:
 * - POST /v1/rooms/:roomId/llm/judgement
 */

import { Router } from 'express';

import { LlmJudgementController } from '../controllers/llm-judgement.controller';

const router = Router();

/**
 * Create judgement (synchronous)
 * POST /v1/rooms/:roomId/llm/judgement
 */
router.post(
    '/rooms/:roomId/llm/judgement',
    LlmJudgementController.createJudgement.bind(LlmJudgementController)
);

export default router;
