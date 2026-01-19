/**
 * WebSocket Server
 * Handles real-time communication for room joining and chat
 * 
 * CRITICAL: Room creation is NOT handled here (use HTTP API)
 * CRITICAL: Only handles JOIN_ROOM and CHAT_SEND
 */

import { Server, type WebSocket, type RawData } from 'ws';
import type { Server as HttpServer } from 'http';
import { randomBytes } from 'crypto';
import { connectionManager } from './services/connection-manager';
import { handleJoinRoom } from './services/handlers/join-room-handler';
import { handleChatSend } from './services/handlers/chat-send-handler';
import type {
    IWSMessage,
    IJoinRoomMessage,
    IChatSendMessage,
} from './types/ws-messages';
import { EWSMessageType, EWSErrorCode } from './types/ws-messages';
import { WS_CONFIG } from './constants/config';

export function initWebSocket(server: HttpServer): void {
    const wss = new Server({
        server,
        path: WS_CONFIG.PATH,
    });

    console.log(`[WebSocket] Server initialized on path: ${WS_CONFIG.PATH}`);

    wss.on('connection', (ws: WebSocket) => {
        const connectionId = generateConnectionId();

        // Register connection
        connectionManager.registerConnection(connectionId, ws);

        console.log(
            `[WebSocket] Client connected: ${connectionId} (Total: ${connectionManager.getAllConnections().length})`
        );

        // Handle incoming messages
        ws.on('message', (data: RawData) => {
            handleMessage(connectionId, data);
        });

        // Handle connection close
        ws.on('close', () => {
            handleDisconnect(connectionId);
        });

        // Handle errors
        ws.on('error', (error) => {
            console.error(
                `[WebSocket] Error for connection ${connectionId}:`,
                error
            );
        });
    });
}

/**
 * Handle incoming WebSocket message
 */
async function handleMessage(
    connectionId: string,
    data: RawData
): Promise<void> {
    try {
        const messageText = rawDataToText(data);
        const message = JSON.parse(messageText) as IWSMessage;

        console.log(
            `[WebSocket] Received ${message.type} from ${connectionId}`
        );

        // Route message to appropriate handler
        switch (message.type) {
            case EWSMessageType.JoinRoom:
                await handleJoinRoom(
                    connectionManager,
                    connectionId,
                    message as IJoinRoomMessage
                );
                break;

            case EWSMessageType.ChatSend:
                await handleChatSend(
                    connectionManager,
                    connectionId,
                    message as IChatSendMessage
                );
                break;

            default:
                connectionManager.sendToConnection(connectionId, {
                    type: EWSMessageType.Error,
                    data: {
                        code: EWSErrorCode.InvalidPayload,
                        message: `Unknown message type: ${(message as IWSMessage).type}`,
                    },
                    timestamp: Date.now(),
                });
        }
    } catch (error) {
        console.error('[WebSocket] Message handling error:', error);
        connectionManager.sendToConnection(connectionId, {
            type: EWSMessageType.Error,
            data: {
                code: EWSErrorCode.InternalError,
                message:
                    error instanceof Error ? error.message : 'Unknown error',
            },
            timestamp: Date.now(),
        });
    }
}

/**
 * Handle connection disconnect
 */
function handleDisconnect(connectionId: string): void {
    console.log(`[WebSocket] Client disconnected: ${connectionId}`);
    connectionManager.handleDisconnect(connectionId);
}

/**
 * Convert RawData to text
 */
function rawDataToText(data: RawData): string {
    if (Buffer.isBuffer(data)) {
        return data.toString('utf-8');
    }
    if (Array.isArray(data)) {
        return Buffer.concat(data).toString('utf-8');
    }
    // ArrayBuffer case
    return Buffer.from(data as ArrayBuffer).toString('utf-8');
}

/**
 * Generate unique connection ID
 */
function generateConnectionId(): string {
    return `conn_${randomBytes(8).toString('hex')}`;
}

