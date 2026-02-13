/**
 * Verdict Service
 * Handles verdict data fetching and WebSocket listening
 *
 * ARCHITECTURE: Singleton service
 * - HTTP fallback to fetch verdict
 * - WebSocket listener for VERDICT_RESULT push
 * - Caches verdict result for page consumption
 */

import { BACKEND_CONFIG } from '../constants/config';
import type { IVerdictResult } from '../types/verdict';
import { EWSMessageType } from '../types/websocket-common';
import type { IWSMessage } from '../types/websocket-common';

import { wsManager } from './websocket-manager';

interface IVerdictHttpResponse {
    success: boolean;
    data?: IVerdictResult;
    error?: { code: string; message: string };
}

class VerdictService {
    private cachedResult: IVerdictResult | null = null;

    /**
     * Fetch verdict result via HTTP (fallback)
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
                            this.cachedResult = response.data;
                            resolve(response.data);
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
     * Register WebSocket listener for VERDICT_RESULT
     */
    startListening(): void {
        wsManager.updateCallbacks({
            onMessage: (data: string) => {
                try {
                    const message = JSON.parse(data) as IWSMessage;
                    if (message.type === EWSMessageType.VerdictResult) {
                        const payload = message.data as {
                            roomId: string;
                            verdict: IVerdictResult;
                        };
                        this.cachedResult = payload.verdict;
                        console.log('[VerdictService] Verdict received');
                    }
                } catch (error: unknown) {
                    console.error('[VerdictService] Parse error:', error);
                }
            },
        });
    }

    /**
     * Get cached verdict result
     */
    getResult(): IVerdictResult | null {
        return this.cachedResult;
    }

    /**
     * Set verdict result (e.g. from page options)
     */
    setResult(result: IVerdictResult): void {
        this.cachedResult = result;
    }

    /**
     * Clear cached result
     */
    clear(): void {
        this.cachedResult = null;
    }
}

export const verdictService = new VerdictService();
