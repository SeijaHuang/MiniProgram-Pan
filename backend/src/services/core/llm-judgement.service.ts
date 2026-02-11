/**
 * LLM Judgement Service
 * Business logic for synchronous LLM judgement
 *
 * ARCHITECTURE: Core Business Service
 * - Calls OpenAI client directly (synchronous flow)
 * - No task queue, no database, no locks
 * - Does NOT persist hostText/participantText
 */

import { createJudgement } from '../../clients/openai.client';
import type {
    ICreateJudgementRequest,
    ILlmJudgementResult,
} from '../../types/llm';

export class LlmJudgementService {
    /**
     * Create a judgement by calling LLM synchronously
     *
     * @param _roomId - Room ID (for logging only)
     * @param payload - hostText and participantText
     * @returns LLM judgement result
     * @throws Error if LLM call fails
     */
    async createJudgement(
        _roomId: string,
        payload: ICreateJudgementRequest
    ): Promise<ILlmJudgementResult> {
        return createJudgement(payload.hostText, payload.participantText);
    }
}

// Singleton instance
export const llmJudgementService = new LlmJudgementService();
