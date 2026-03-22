/**
 * LLM Judgement Service
 * Business logic for judgment verdict (判决书)
 *
 * ARCHITECTURE: Core Business Service
 * - Calls OpenAI client directly (synchronous flow)
 * - No task queue, no database, no locks
 */

import { createJudgmentVerdict } from '../../clients/openai.client';
import type {
    ICreateJudgmentRequest,
    IJudgmentResponse,
} from '../../types/llm';

export class LlmJudgementService {
    /**
     * Create a judgment verdict (判决书) by calling LLM
     *
     * @param _roomId - Room ID (for logging only)
     * @param payload - player1Speech and player2Speech
     * @returns Judgment verdict result
     * @throws Error if LLM call fails
     */
    async createJudgment(
        _roomId: string,
        payload: ICreateJudgmentRequest
    ): Promise<IJudgmentResponse> {
        return createJudgmentVerdict(
            payload.player1.nickname,
            payload.player1.speech,
            payload.player2.nickname,
            payload.player2.speech,
            payload.idempotencyKey
        );
    }
}

// Singleton instance
export const llmJudgementService = new LlmJudgementService();
