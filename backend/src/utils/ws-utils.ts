/**
 * WebSocket utilities
 * Helper functions for WebSocket operations
 */

import type { RawData } from 'ws';

/**
 * Convert RawData to string
 */
export function rawDataToText(data: RawData): string {
    if (typeof data === 'string') {
        return data;
    }
    if (Buffer.isBuffer(data)) {
        return data.toString('utf8');
    }
    if (Array.isArray(data)) {
        return Buffer.concat(data).toString('utf8');
    }
    // ArrayBuffer
    return Buffer.from(data).toString('utf8');
}

/**
 * Generate unique client ID
 */
export function generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate unique room ID
 */
export function generateRoomId(): string {
    return `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate unique player ID
 */
export function generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
