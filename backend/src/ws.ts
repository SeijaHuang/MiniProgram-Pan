import { Server, type WebSocket, type RawData } from 'ws';
import type { Server as HttpServer } from 'http';
import { WSClient } from './utils/ws-client';
import { rawDataToText, generateClientId } from './utils/ws-utils';
import { WS_CONFIG } from './constants/config';
import { MessageType } from './types/ws-messages';
import type { IBaseMessage } from './types/ws-messages';
import { roomCreateHandler } from './services/handlers/room-create-handler';
import { roomJoinHandler } from './services/handlers/room-join-handler';
import { playerReadyHandler } from './services/handlers/player-ready-handler';
import { gameMoveHandler } from './services/handlers/game-move-handler';
import { gameRoomManager } from './services/game-room-manager';

// Store all connected clients
const clients = new Map<string, WSClient>();

export function initWebSocket(server: HttpServer): void {
    const wss = new Server({
        server,
        path: WS_CONFIG.PATH,
    });

    console.log(`WebSocket server initialized on path: ${WS_CONFIG.PATH}`);

    // Setup heartbeat interval
    startHeartbeatCheck();

    // Setup room cleanup interval
    startRoomCleanup();

    wss.on('connection', (ws: WebSocket) => {
        const clientId = generateClientId();
        const client = new WSClient(clientId, ws);
        clients.set(clientId, client);

        console.log(`Client connected: ${clientId} (Total: ${clients.size})`);

        // Send welcome message
        client.send(MessageType.WELCOME, {
            clientId,
            serverTime: Date.now(),
        });

        // Handle incoming messages
        ws.on('message', (data: RawData) => {
            handleMessage(client, data);
        });

        // Handle connection close
        ws.on('close', () => {
            handleDisconnect(client);
        });

        // Handle errors
        ws.on('error', (error) => {
            console.error(`WebSocket error for client ${clientId}:`, error);
        });
    });
}

/**
 * Handle incoming message from client
 */
async function handleMessage(client: WSClient, data: RawData): Promise<void> {
    try {
        const messageText = rawDataToText(data);
        const message = JSON.parse(messageText) as IBaseMessage;

        console.log(`Received message from ${client.id}: ${message.type}`);

        // Update heartbeat timestamp
        client.updateHeartbeat();

        // Route message to appropriate handler
        switch (message.type) {
            case MessageType.HEARTBEAT:
                handleHeartbeat(client, message);
                break;

            case MessageType.ROOM_CREATE:
                await roomCreateHandler.handle(client, message as never);
                break;

            case MessageType.ROOM_JOIN:
                await roomJoinHandler.handle(client, message as never);
                break;

            case MessageType.PLAYER_READY:
                await playerReadyHandler.handle(client, message as never);
                break;

            case MessageType.GAME_MOVE:
                await gameMoveHandler.handle(client, message as never);
                break;

            default:
                client.send(MessageType.ERROR, {
                    code: 'UNKNOWN_MESSAGE_TYPE',
                    message: `Unknown message type: ${message.type}`,
                });
        }
    } catch (error) {
        console.error('Failed to parse message:', error);
        client.send(MessageType.ERROR, {
            code: 'INVALID_MESSAGE',
            message: 'Failed to parse message',
        });
    }
}

/**
 * Handle heartbeat message
 */
function handleHeartbeat(client: WSClient, message: IBaseMessage): void {
    client.send(MessageType.HEARTBEAT_ACK, {
        timestamp: message.timestamp,
        serverTime: Date.now(),
    });
}

/**
 * Handle client disconnect
 */
function handleDisconnect(client: WSClient): void {
    console.log(`Client disconnected: ${client.id}`);

    // Notify room about player disconnect
    if (client.roomId && client.playerId) {
        gameRoomManager.setPlayerDisconnected(
            client.roomId,
            client.playerId
        );

        // Notify other players in the room
        broadcastToRoom(client.roomId, MessageType.PLAYER_DISCONNECTED, {
            playerId: client.playerId,
        });
    }

    clients.delete(client.id);
    console.log(`Total clients: ${clients.size}`);
}

/**
 * Start periodic heartbeat check
 * Removes clients that haven't sent heartbeat within timeout
 */
function startHeartbeatCheck(): void {
    setInterval(() => {
        const now = Date.now();
        let removedCount = 0;

        clients.forEach((client, clientId) => {
            if (!client.isAlive(WS_CONFIG.CLIENT_TIMEOUT)) {
                console.log(`Removing inactive client: ${clientId}`);
                client.close(1000, 'Heartbeat timeout');
                clients.delete(clientId);
                removedCount++;
            }
        });

        if (removedCount > 0) {
            console.log(
                `Removed ${removedCount} inactive clients. Active: ${clients.size}`
            );
        }
    }, WS_CONFIG.HEARTBEAT_INTERVAL);
}

/**
 * Start periodic room cleanup
 * Removes inactive rooms
 */
function startRoomCleanup(): void {
    setInterval(() => {
        gameRoomManager.cleanupInactiveRooms();
    }, WS_CONFIG.HEARTBEAT_INTERVAL * 2);
}

/**
 * Get client by ID
 */
export function getClient(clientId: string): WSClient | undefined {
    return clients.get(clientId);
}

/**
 * Get all clients
 */
export function getAllClients(): Map<string, WSClient> {
    return clients;
}

/**
 * Broadcast message to all clients
 */
export function broadcast<T>(type: MessageType, data: T): void {
    clients.forEach((client) => {
        client.send(type, data);
    });
}

/**
 * Broadcast message to clients in a specific room
 */
export function broadcastToRoom<T>(
    roomId: string,
    type: MessageType,
    data: T,
    excludeClientId?: string
): void {
    clients.forEach((client) => {
        if (
            client.roomId === roomId &&
            client.id !== excludeClientId
        ) {
            client.send(type, data);
        }
    });
}

