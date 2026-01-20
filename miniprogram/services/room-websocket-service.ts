/**
 * Room WebSocket Service
 * Handles room-related WebSocket operations
 *
 * Responsibilities:
 * - Join room via WebSocket
 * - Handle JOIN_ACK messages
 * - Track room state from server
 */

import { wsManager } from './websocket-manager';
import type { IUser } from '../models/user';
import type { IRoom } from '../models/room';
import { EWSMessageType } from '../types/websocket-common';
import type {
    IJoinRoomMessage,
    IJoinAckMessage,
} from '../types/room-websocket';

type JoinAckHandler = (room: IRoom) => void;

class RoomWebSocketService {
    private currentRoomCode: string | null = null;
    private currentUser: IUser | null = null;
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
                console.log('[RoomWebSocketService] Connected');
                // Rejoin room if reconnecting
                if (this.currentRoomCode && this.currentUser) {
                    this.joinRoom(this.currentRoomCode, this.currentUser);
                }
            },
        });
    }

    /**
     * Join a room
     */
    joinRoom(roomCode: string, user: IUser): void {
        if (!wsManager.isConnected()) {
            console.error('[RoomWebSocketService] Not connected');
            return;
        }

        this.currentRoomCode = roomCode;
        this.currentUser = user;

        const message: IJoinRoomMessage = {
            type: EWSMessageType.JoinRoom,
            data: {
                roomCode,
                user,
            },
            timestamp: Date.now(),
        };

        wsManager.send(message);
        console.log(`[RoomWebSocketService] Sent JOIN_ROOM for ${roomCode}`);
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
            console.error(
                '[RoomWebSocketService] Failed to parse message:',
                error
            );
        }
    }

    /**
     * Handle JOIN_ACK message
     */
    private handleJoinAck(message: IJoinAckMessage): void {
        console.log('[RoomWebSocketService] JOIN_ACK received:', message.data);

        if (this.joinAckHandler) {
            this.joinAckHandler(message.data.room);
        }
    }

    /**
     * Clear room state
     */
    clear(): void {
        this.currentRoomCode = null;
        this.currentUser = null;
    }

    /**
     * Get current room code
     */
    getCurrentRoomCode(): string | null {
        return this.currentRoomCode;
    }
}

// Export singleton instance
export const roomWebSocketService = new RoomWebSocketService();
