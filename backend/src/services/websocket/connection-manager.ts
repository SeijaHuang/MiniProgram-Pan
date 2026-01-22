/**
 * Connection Manager
 * Manages WebSocket connections and their metadata
 *
 * CRITICAL: Separates runtime connection data from domain models
 * CRITICAL: Handles connection-to-user-to-room binding
 * CRITICAL: Handles disconnect cleanup
 */

import type { WebSocket } from 'ws';
import { roomManager } from './room-manager';

interface IConnectionData {
    connectionId: string;
    socket: WebSocket;
    userId?: string;
    roomId?: string;
}

export class ConnectionManager {
    private static instance: ConnectionManager;
    private connections: Map<string, IConnectionData> = new Map();
    private userToConnection: Map<string, string> = new Map();

    private constructor() {}

    static getInstance(): ConnectionManager {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager();
        }
        return ConnectionManager.instance;
    }

    /**
     * Register a new WebSocket connection
     */
    registerConnection(connectionId: string, socket: WebSocket): void {
        this.connections.set(connectionId, {
            connectionId,
            socket,
        });
        console.log(
            `[ConnectionManager] Registered connection: ${connectionId} (Total: ${this.connections.size})`
        );
    }

    /**
     * Bind connection to user and room
     * CRITICAL: Called after successful JOIN_ROOM
     */
    bindConnection(connectionId: string, userId: string, roomId: string): void {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            throw new Error(`Connection ${connectionId} not found`);
        }

        connection.userId = userId;
        connection.roomId = roomId;
        this.userToConnection.set(userId, connectionId);

        console.log(
            `[ConnectionManager] Bound connection ${connectionId} to user ${userId} in room ${roomId}`
        );
    }

    /**
     * Get connection data
     */
    getConnection(connectionId: string): IConnectionData | undefined {
        return this.connections.get(connectionId);
    }

    /**
     * Send message to a specific connection
     */
    sendToConnection(connectionId: string, message: unknown): void {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            console.warn(
                `[ConnectionManager] Connection ${connectionId} not found, cannot send message`
            );
            return;
        }

        if (connection.socket.readyState === 1) {
            // WebSocket.OPEN
            connection.socket.send(JSON.stringify(message));
        } else {
            console.warn(
                `[ConnectionManager] Connection ${connectionId} is not open, cannot send message`
            );
        }
    }

    /**
     * Broadcast message to all participants in a room
     * CRITICAL: This is the ONLY way to broadcast messages
     */
    broadcastToRoom(roomId: string, message: unknown): void {
        const room = roomManager.getRoomById(roomId);
        if (!room) {
            console.warn(
                `[ConnectionManager] Room ${roomId} not found, cannot broadcast`
            );
            return;
        }

        // Send to all participants
        for (const participant of room.participants) {
            const connectionId = this.userToConnection.get(
                participant.user.userId
            );
            if (connectionId) {
                this.sendToConnection(connectionId, message);
            }
        }

        console.log(
            `[ConnectionManager] Broadcast to room ${roomId} (${room.participants.length} participants)`
        );
    }

    /**
     * Handle connection disconnect
     * CRITICAL: Cleans up user from room
     */
    handleDisconnect(connectionId: string): void {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            return;
        }

        console.log(
            `[ConnectionManager] Handling disconnect for ${connectionId}`
        );

        // If user was in a room, remove them
        if (connection.userId && connection.roomId) {
            const remainingRoom = roomManager.leaveRoom(
                connection.roomId,
                connection.userId
            );

            // If there's still someone in the room, notify them
            if (remainingRoom) {
                this.broadcastToRoom(connection.roomId, {
                    type: 'JOIN_ACK',
                    data: {
                        room: remainingRoom,
                    },
                    timestamp: Date.now(),
                });
            }

            // Clean up user-to-connection mapping
            this.userToConnection.delete(connection.userId);
        }

        // Remove connection
        this.connections.delete(connectionId);
        console.log(
            `[ConnectionManager] Removed connection ${connectionId} (Total: ${this.connections.size})`
        );
    }

    /**
     * Get all connections (for debugging)
     */
    getAllConnections(): IConnectionData[] {
        return Array.from(this.connections.values());
    }
}

export const connectionManager = ConnectionManager.getInstance();
