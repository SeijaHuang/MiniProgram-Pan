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

import { BACKEND_CONFIG } from '../constants/config';
import type { IVerdictResult, IDimensionScores } from '../types/verdict';
import type {
    IBackendVerdictResult,
    IVerdictResultPayload,
    IVerdictFailedPayload,
} from '../types/verdict-ws';
import { EWSMessageType } from '../types/websocket-common';
import type { IWSMessage } from '../types/websocket-common';

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
        backend: IBackendVerdictResult['radarChart']['host']
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

        // Map secret reports: backend uses array, frontend uses host/guest object
        const hostReport = backend.secretReports.find(r => r.role === 'host');
        const guestReport = backend.secretReports.find(r => r.role === 'guest');

        return {
            caseNumber: backend.caseNumber,
            winnerId: backend.winnerId,
            loserId: backend.loserId,
            responsibility: {
                host: backend.responsibility.host,
                guest: backend.responsibility.guest,
                thirdParty,
            },
            battleStats: {
                host: this.mapDimensionScores(backend.radarChart.host),
                guest: this.mapDimensionScores(backend.radarChart.guest),
            },
            verdictSummary: backend.verdict,
            punishmentTask: {
                loserId: backend.punishmentTask.role,
                task: backend.punishmentTask.task,
                deadline: '须在24小时内完成',
            },
            secretReports: {
                host: {
                    title: hostReport?.highestDimension ?? '',
                    advice: hostReport?.advice ?? '',
                },
                guest: {
                    title: guestReport?.highestDimension ?? '',
                    advice: guestReport?.advice ?? '',
                },
            },
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
                        console.log(
                            '[VerdictService] Verdict received and cached'
                        );
                        if (this.resultHandler) {
                            this.resultHandler(mapped);
                        }
                    } else if (message.type === EWSMessageType.VerdictFailed) {
                        const payload = message.data as IVerdictFailedPayload;
                        console.warn(
                            '[VerdictService] Verdict failed:',
                            payload.error
                        );
                        if (this.errorHandler) {
                            this.errorHandler(payload);
                        }
                    }
                } catch (error: unknown) {
                    console.error('[VerdictService] Parse error:', error);
                }
            },
        });

        console.log('[VerdictService] Listening for verdict messages');
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
                url:
                    `${BACKEND_CONFIG.HTTP_BASE_URL}` +
                    `/v1/rooms/${roomId}/judgments`,
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
