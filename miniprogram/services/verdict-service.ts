/**
 * Verdict Service
 * Handles verdict data fetching and WebSocket listening
 *
 * ARCHITECTURE: Singleton service
 * - WebSocket listener for VERDICT_RESULT / VERDICT_FAILED push
 * - Caches verdict result for page consumption
 * - Maps backend verdict format to frontend format
 * - HTTP fallback to fetch verdict
 */

import { API_BASE_URL } from '../constants/env';
import type { IVerdictResult, IDimensionScores } from '../types/verdict';
import type {
    IBackendDimensionScores,
    IBackendVerdictResult,
    IVerdictResultPayload,
    IVerdictFailedPayload,
} from '../types/verdict-ws';
import { EWSMessageType } from '../types/websocket-common';
import type { IWSMessage } from '../types/websocket-common';
import { logger } from '../utils/logger';

import { wsManager } from './websocket-manager';

interface IVerdictHttpResponse {
    success: boolean;
    data?: IBackendVerdictResult;
    error?: { code: string; message: string };
}

type VerdictResultHandler = (result: IVerdictResult) => void;
type VerdictErrorHandler = (payload: IVerdictFailedPayload) => void;

class VerdictService {
    private cachedResult: IVerdictResult | null = null;
    private resultHandler: VerdictResultHandler | null = null;
    private errorHandler: VerdictErrorHandler | null = null;

    /**
     * Map backend dimension scores to frontend format
     * Backend uses logicFallacy/coquettishDamage, frontend uses logicSlippery/charmAttack
     */
    private mapDimensionScores(
        backend: IBackendDimensionScores
    ): IDimensionScores {
        return {
            mouthHard: backend.mouthHard,
            oldAccountDigging: backend.oldAccountDigging,
            logicSlippery: backend.logicFallacy,
            charmAttack: backend.coquettishDamage,
            survivalInstinct: backend.survivalInstinct,
            victimActing: backend.victimActing,
        };
    }

    /**
     * Map backend verdict result to frontend IVerdictResult format
     */
    private mapVerdictResult(backend: IBackendVerdictResult): IVerdictResult {
        // Map third-party factors: backend uses "name", frontend uses "reason"
        const thirdParty = backend.responsibility.thirdParty.factors.map(f => ({
            reason: f.name,
            percentage: f.percentage,
            emoji: f.emoji,
        }));

        // Map responsibility players
        const players = backend.responsibility.players.map(p => ({
            userId: p.userId,
            nickname: p.nickname,
            percentage: p.percentage,
        }));

        // Map radar chart players with dimension score renaming
        const radarChart = backend.radarChart.map(p => ({
            userId: p.userId,
            nickname: p.nickname,
            scores: this.mapDimensionScores(p.scores),
        }));

        // Map secret reports: backend uses highestDimension, frontend uses title
        const secretReports = backend.secretReports.map(r => ({
            userId: r.userId,
            title: r.highestDimension,
            advice: r.advice,
        }));

        return {
            caseNumber: backend.caseNumber,
            winnerId: backend.winnerId,
            loserId: backend.loserId,
            responsibility: { players, thirdParty },
            radarChart,
            verdictSummary: backend.verdict,
            punishmentTask: {
                loserUserId: backend.punishmentTask.loserUserId,
                loserNickname: backend.punishmentTask.loserNickname,
                task: backend.punishmentTask.task,
                deadline: '须在24小时内完成',
            },
            secretReports,
        };
    }

    /**
     * Register WebSocket listener for VERDICT_RESULT / VERDICT_FAILED
     * Call from verdict-waiting page onLoad
     */
    startListening(options: {
        onResult: VerdictResultHandler;
        onError: VerdictErrorHandler;
    }): void {
        this.resultHandler = options.onResult;
        this.errorHandler = options.onError;

        wsManager.updateCallbacks({
            onMessage: (data: string) => {
                try {
                    const message = JSON.parse(data) as IWSMessage;

                    if (message.type === EWSMessageType.VerdictResult) {
                        const payload = message.data as IVerdictResultPayload;
                        const mapped = this.mapVerdictResult(payload.verdict);
                        this.cachedResult = mapped;
                        logger.log(
                            'VerdictService',
                            'Verdict received and cached'
                        );
                        if (this.resultHandler) {
                            this.resultHandler(mapped);
                        }
                    } else if (message.type === EWSMessageType.VerdictFailed) {
                        const payload = message.data as IVerdictFailedPayload;
                        logger.warn(
                            'VerdictService',
                            'Verdict failed:',
                            payload.error
                        );
                        if (this.errorHandler) {
                            this.errorHandler(payload);
                        }
                    }
                } catch (error: unknown) {
                    logger.error('VerdictService', 'Parse error:', error);
                }
            },
        });

        logger.log('VerdictService', 'Listening for verdict messages');
    }

    /**
     * Get cached verdict result
     */
    getResult(): IVerdictResult | null {
        return this.cachedResult;
    }

    /**
     * Fetch verdict result via HTTP (fallback for reconnection)
     */
    async fetchVerdict(roomId: string): Promise<IVerdictResult> {
        return new Promise<IVerdictResult>((resolve, reject) => {
            wx.request({
                url: `${API_BASE_URL}/v1/rooms/${roomId}/judgments`,
                method: 'POST',
                header: {
                    'content-type': 'application/json',
                },
                data: {
                    player1Speech: '',
                    player2Speech: '',
                },
                success: (
                    res: WechatMiniprogram.RequestSuccessCallbackResult
                ) => {
                    if (res.statusCode === 200) {
                        const response = res.data as IVerdictHttpResponse;
                        if (response.success && response.data) {
                            const mapped = this.mapVerdictResult(response.data);
                            this.cachedResult = mapped;
                            resolve(mapped);
                        } else {
                            reject(
                                new Error(
                                    response.error?.message ??
                                        'Failed to fetch verdict'
                                )
                            );
                        }
                    } else {
                        reject(new Error('Failed to fetch verdict'));
                    }
                },
                fail: (error: WechatMiniprogram.GeneralCallbackResult) => {
                    reject(new Error(`Network error: ${error.errMsg}`));
                },
            });
        });
    }

    /**
     * Clear cached result and handlers
     */
    clear(): void {
        this.cachedResult = null;
        this.resultHandler = null;
        this.errorHandler = null;
    }
}

export const verdictService = new VerdictService();
