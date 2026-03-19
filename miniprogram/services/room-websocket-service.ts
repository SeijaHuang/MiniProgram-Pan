/**
 * Room WebSocket Service
 * Handles room-related WebSocket operations
 *
 * Responsibilities:
 * - Join room via WebSocket
 * - Handle JOIN_ACK messages
 * - Track room state from server
 */

import type {
    IJoinRoomMessage,
    IJoinAckMessage,
    IJoinAckData,
} from '../types/room-websocket';
import { EWSMessageType } from '../types/websocket-common';
import { logger } from '../utils/logger';

import { wsManager } from './websocket-manager';

type JoinAckHandler = (data: IJoinAckData) => void;

class RoomWebSocketService {
    private currentRoomCode: string | null = null;
    private currentNickname: string | null = null;
    private joinAckHandler: JoinAckHandler | null = null;

    /**
     * Initialize WebSocket connection for room operations
     */
    initialize(onJoinAck: JoinAckHandler): void {
        this.joinAckHandler = onJoinAck;

        wsManager.updateCallbacks({
            onMessage: (data: string) => {
                this.handleMessage(data);
            },
            onConnect: () => {
                logger.log('RoomWS', 'Connected');
                // Rejoin room if reconnecting
                if (this.currentRoomCode && this.currentNickname) {
                    this.joinRoom(this.currentRoomCode, this.currentNickname);
                }
            },
        });
    }

    /**
     * Join a room
     */
    joinRoom(roomCode: string, nickname: string): void {
        if (!wsManager.isConnected()) {
            logger.error('RoomWS', 'Not connected');
            return;
        }

        this.currentRoomCode = roomCode;
        this.currentNickname = nickname;

        const message: IJoinRoomMessage = {
            type: EWSMessageType.JoinRoom,
            data: {
                roomCode,
                nickname,
            },
            timestamp: Date.now(),
        };

        wsManager.send(message);
        logger.log('RoomWS', `Sent JOIN_ROOM for ${roomCode}`);
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleMessage(data: string): void {
        try {
            const message = JSON.parse(data) as IJoinAckMessage;

            if (message.type === EWSMessageType.JoinAck) {
                this.handleJoinAck(message);
            }
            // Other message types will be handled by other services
        } catch (error) {
            logger.error('RoomWS', 'Failed to parse message:', error);
        }
    }

    /**
     * Handle JOIN_ACK message
     */
    private handleJoinAck(message: IJoinAckMessage): void {
        logger.log('RoomWS', 'JOIN_ACK received:', message.data);

        if (this.joinAckHandler) {
            this.joinAckHandler(message.data);
        }
    }

    /**
     * Clear room state
     */
    clear(): void {
        this.currentRoomCode = null;
        this.currentNickname = null;
    }
}

// Export singleton instance
export const roomWebSocketService = new RoomWebSocketService();
