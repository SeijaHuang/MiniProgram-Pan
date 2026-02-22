/**
 * Verdict Orchestrator Service
 * Orchestrates LLM verdict generation and WebSocket broadcast
 *
 * ARCHITECTURE: Core Business Service
 * - Calls LLM service to generate judgment
 * - Transforms result using verdict mapper
 * - Broadcasts result via WebSocket
 * - Handles errors and retry logic
 */

import { roomManager } from '../websocket/room-manager';
import { llmJudgementService } from './llm-judgement.service';
import { verdictMapperService } from './verdict-mapper.service';
import { VERDICT_CONFIG } from '../../constants/config';
import { EWSMessageType } from '../../types/websocket';
import type { ConnectionManager } from '../websocket/connection-manager';
import type {
    IVerdictResultData,
    IVerdictFailedData,
} from '../../types/websocket/verdict';
import { logger } from '../../utils/logger';

export class VerdictOrchestratorService {
    /**
     * Generate verdict for a room
     * This is the main orchestration method
     *
     * @param roomId - Room ID
     * @param connectionManager - Connection manager for broadcasting
     */
    async generateVerdict(
        roomId: string,
        connectionManager: ConnectionManager
    ): Promise<void> {
        try {
            // 1. Get room
            const room = roomManager.getRoomById(roomId);
            if (!room) {
                logger.error('VerdictOrchestrator', `Room ${roomId} not found`);
                return;
            }

            // 2. Validate speech state exists
            if (!room.speechState) {
                throw new Error('Speech state not initialized');
            }

            // 3. Check if already processing (prevent race condition)
            if (room.verdictStatus === 'processing') {
                logger.log(
                    'VerdictOrchestrator',
                    `Verdict already processing for room ${roomId}`
                );
                return;
            }

            // 4. Set status to processing
            room.verdictStatus = 'processing';

            // 5. Get retry count
            const retryCount = room.verdictRetryCount || 0;
            logger.log(
                'VerdictOrchestrator',
                `Generating verdict for room ${roomId} (attempt ${retryCount + 1}/${VERDICT_CONFIG.MAX_RETRIES})`
            );

            // 6. Validate speeches are not empty
            const hostText = room.speechState.hostText.trim();
            const guestText = room.speechState.guestText.trim();

            if (!hostText && !guestText) {
                throw new Error('Both speeches are empty');
            }

            // 7. Call LLM service with timeout
            const judgment = await this.callLLMWithTimeout(
                roomId,
                hostText || '（无发言）',
                guestText || '（无发言）'
            );

            // 8. Transform to frontend format
            const verdict = verdictMapperService.mapJudgmentToVerdict(
                judgment,
                room.hostUserId,
                room.participants
            );

            // 9. Store result in room
            room.verdictResult = verdict;
            room.verdictStatus = 'completed';

            logger.log(
                'VerdictOrchestrator',
                `Verdict generated successfully for room ${roomId}, winner: ${verdict.winnerId}`
            );

            // 10. Broadcast VERDICT_RESULT
            const resultData: IVerdictResultData = {
                roomId,
                verdict,
            };

            connectionManager.broadcastToRoom(roomId, {
                type: EWSMessageType.VerdictResult,
                data: resultData,
                timestamp: Date.now(),
            });
        } catch (error) {
            // Handle error
            this.handleVerdictError(roomId, error, connectionManager);
        }
    }

    /**
     * Call LLM service with timeout
     */
    private async callLLMWithTimeout(
        roomId: string,
        hostText: string,
        guestText: string
    ): Promise<Awaited<ReturnType<typeof llmJudgementService.createJudgment>>> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error('LLM call timeout'));
            }, VERDICT_CONFIG.LLM_TIMEOUT_MS);
        });

        const llmPromise = llmJudgementService.createJudgment(roomId, {
            player1Speech: hostText,
            player2Speech: guestText,
        });

        return Promise.race([llmPromise, timeoutPromise]);
    }

    /**
     * Handle verdict generation error
     */
    private handleVerdictError(
        roomId: string,
        error: unknown,
        connectionManager: ConnectionManager
    ): void {
        const room = roomManager.getRoomById(roomId);
        if (!room) {
            return;
        }

        // Increment retry count
        room.verdictRetryCount = (room.verdictRetryCount || 0) + 1;
        room.verdictStatus = 'failed';

        const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

        logger.error(
            'VerdictOrchestrator',
            `Verdict generation failed for room ${roomId}: ${errorMessage}`
        );

        // Check if can retry
        const canRetry = room.verdictRetryCount < VERDICT_CONFIG.MAX_RETRIES;

        // Broadcast VERDICT_FAILED
        const failedData: IVerdictFailedData = {
            roomId,
            error: errorMessage,
            canRetry,
            retryCount: room.verdictRetryCount,
        };

        connectionManager.broadcastToRoom(roomId, {
            type: EWSMessageType.VerdictFailed,
            data: failedData,
            timestamp: Date.now(),
        });

        if (!canRetry) {
            logger.error(
                'VerdictOrchestrator',
                `Max retries reached for room ${roomId}, fallback to HTTP endpoint`
            );
        }
    }
}

// Singleton instance
export const verdictOrchestratorService = new VerdictOrchestratorService();
