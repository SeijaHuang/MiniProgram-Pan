/**
 * Post-Game WebSocket Types
 * Types for post-game interaction messages (punishment/mercy effects)
 */

import type { IWSMessage } from './base';
import { EWSMessageType } from './base';

/**
 * POST_GAME_ACTION payload (Client → Server)
 */
export interface IPostGameActionData {
    roomId: string;
    action: 'execute_punishment' | 'beg_for_mercy';
    remainingCount: number;
}

export interface IPostGameActionMessage extends IWSMessage<IPostGameActionData> {
    type: EWSMessageType.PostGameAction;
}

/**
 * POST_GAME_EFFECT payload (Server → Client)
 */
export interface IPostGameEffectPayload {
    roomId: string;
    effect: 'stamp_death' | 'beg_emoji';
    fromUserId: string;
    remainingCount: number;
}
