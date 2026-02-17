/**
 * DRUM_TAP Business Logic Handler
 * Handles drum tap business logic
 *
 * ARCHITECTURE: Business logic layer
 * - Validates tap message
 * - Checks game exists and is running
 * - Calls domain service (DrumGameManager)
 * - Returns result (success/error)
 * - Does NOT format or send WebSocket messages
 */

import type { IDrumTapMessage } from '../../types/websocket';
import { EWSErrorCode, EPlayerRole } from '../../types/websocket';
import { EGamePhase } from '../../types/websocket/drum';
import { drumGameManager } from '../websocket/drum-game-manager';
import { DrumTapDataSchema } from '../../models/schemas/drum-message.schema';
import { validatePayload } from './handler-utils';

export interface IDrumTapResult {
    success: true;
    roomId: string;
    role: EPlayerRole;
    delta: number;
}

export interface IDrumTapError {
    success: false;
    code: EWSErrorCode;
    message: string;
}

export type TDrumTapHandlerResult = IDrumTapResult | IDrumTapError;

export function handleDrumTap(message: IDrumTapMessage): TDrumTapHandlerResult {
    // Validate payload schema
    const v = validatePayload(DrumTapDataSchema, message.data);
    if (!v.success) return v;

    const { roomId, role, delta } = v.data;

    // Check game exists
    const game = drumGameManager.getGame(roomId);
    if (!game) {
        return {
            success: false,
            code: EWSErrorCode.RoomNotFound,
            message: 'Game not found',
        };
    }

    // Check game is running
    if (game.phase !== EGamePhase.Running) {
        return {
            success: false,
            code: EWSErrorCode.RoomNotReady,
            message: 'Game is not running',
        };
    }

    // Record tap
    drumGameManager.recordTap(roomId, role, delta);

    console.log(
        `[DRUM_TAP] Room ${roomId}: ${role} +${delta} ` +
            `(Organizer: ${game.organizerScore}, ` +
            `Joiner: ${game.joinerScore})`
    );

    return {
        success: true,
        roomId,
        role,
        delta,
    };
}
