/**
 * Post-Game Service
 * Handles post-game interactions (punishment, mercy, leave)
 *
 * ARCHITECTURE: Singleton service
 * - Sends post-game actions via WebSocket
 * - Listens for post-game effects from opponent
 * - Callback-based event handling
 */

import type {
    IPostGameEffectPayload,
    ILeaveTogetherAckPayload,
} from '../types/verdict';
import { EWSMessageType } from '../types/websocket-common';
import type { IWSMessage } from '../types/websocket-common';

import { wsManager } from './websocket-manager';

type EffectCallback = (effect: IPostGameEffectPayload) => void;
type LeaveAckCallback = (payload: ILeaveTogetherAckPayload) => void;

class PostGameService {
    private effectCallback: EffectCallback | null = null;
    private leaveAckCallback: LeaveAckCallback | null = null;

    /**
     * Send post-game action (execute_punishment or beg_for_mercy)
     */
    sendAction(
        roomId: string,
        action: 'execute_punishment' | 'beg_for_mercy',
        remainingCount: number
    ): void {
        wsManager.send({
            type: EWSMessageType.PostGameAction,
            data: {
                roomId,
                action,
                remainingCount,
            },
            timestamp: Date.now(),
        });
    }

    /**
     * Send leave-together request
     */
    sendLeaveTogether(roomId: string): void {
        wsManager.send({
            type: EWSMessageType.LeaveTogether,
            data: {
                roomId,
            },
            timestamp: Date.now(),
        });
    }

    /**
     * Register effect callback
     */
    onEffect(callback: EffectCallback): void {
        this.effectCallback = callback;
    }

    /**
     * Register leave-together ack callback
     */
    onLeaveAck(callback: LeaveAckCallback): void {
        this.leaveAckCallback = callback;
    }

    /**
     * Initialize WebSocket listening for post-game messages
     */
    initialize(): void {
        wsManager.updateCallbacks({
            onMessage: (data: string) => {
                try {
                    const message = JSON.parse(data) as IWSMessage;
                    this.handleMessage(message);
                } catch (error: unknown) {
                    console.error('[PostGameService] Parse error:', error);
                }
            },
        });
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleMessage(message: IWSMessage): void {
        switch (message.type) {
            case EWSMessageType.PostGameEffect: {
                const effectPayload = message.data as IPostGameEffectPayload;
                if (this.effectCallback) {
                    this.effectCallback(effectPayload);
                }
                break;
            }
            case EWSMessageType.LeaveTogetherAck: {
                const leavePayload = message.data as ILeaveTogetherAckPayload;
                if (this.leaveAckCallback) {
                    this.leaveAckCallback(leavePayload);
                }
                break;
            }
            default:
                break;
        }
    }

    /**
     * Cleanup callbacks
     */
    destroy(): void {
        this.effectCallback = null;
        this.leaveAckCallback = null;
    }
}

export const postGameService = new PostGameService();
