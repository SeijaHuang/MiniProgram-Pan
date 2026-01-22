/**
 * WebSocket Controller
 * Handles WebSocket message routing and response formatting
 *
 * ARCHITECTURE: Controller layer
 * - Routes messages to appropriate handlers
 * - Handles connection lifecycle
 * - Formats WebSocket messages
 * - Does NOT contain business logic
 */

import type { RawData } from 'ws';
import { connectionManager } from '../services/websocket/connection-manager';
import {
    handleJoinRoom,
    type TJoinRoomHandlerResult,
} from '../services/handlers/join-room-handler';
import {
    handleChatSend,
    type TChatSendHandlerResult,
} from '../services/handlers/chat-send-handler';
import type {
    IWSMessage,
    IJoinRoomMessage,
    IChatSendMessage,
} from '../types/websocket';
import { EWSMessageType, EWSErrorCode } from '../types/websocket';

export class WebSocketController {
    /**
     * Handle incoming WebSocket message
     * Routes message to appropriate handler based on type
     */
    static handleMessage(connectionId: string, data: RawData): void {
        try {
            const messageText = WebSocketController.rawDataToText(data);
            const message = JSON.parse(messageText) as IWSMessage;

            console.log(
                `[WebSocketController] Received ${message.type} from ${connectionId}`
            );

            // Route message to appropriate handler
            switch (message.type) {
                case EWSMessageType.JoinRoom:
                    WebSocketController.handleJoinRoomMessage(
                        connectionId,
                        message as IJoinRoomMessage
                    );
                    break;

                case EWSMessageType.ChatSend:
                    WebSocketController.handleChatSendMessage(
                        connectionId,
                        message as IChatSendMessage
                    );
                    break;

                default:
                    WebSocketController.sendError(
                        connectionId,
                        EWSErrorCode.InvalidPayload,
                        `Unknown message type: ${message.type}`
                    );
            }
        } catch (error) {
            console.error(
                '[WebSocketController] Message handling error:',
                error
            );
            WebSocketController.sendError(
                connectionId,
                EWSErrorCode.InternalError,
                error instanceof Error ? error.message : 'Unknown error'
            );
        }
    }

    /**
     * Handle JOIN_ROOM message
     * Calls business logic handler and formats response
     */
    private static handleJoinRoomMessage(
        connectionId: string,
        message: IJoinRoomMessage
    ): void {
        const result: TJoinRoomHandlerResult = handleJoinRoom(
            connectionManager,
            connectionId,
            message
        );

        if (!result.success) {
            // Send error to client
            WebSocketController.sendError(
                connectionId,
                result.code,
                result.message
            );
            return;
        }

        // Broadcast JOIN_ACK to ALL participants
        connectionManager.broadcastToRoom(result.room.roomId, {
            type: EWSMessageType.JoinAck,
            data: {
                room: result.room,
            },
            timestamp: Date.now(),
        });
    }

    /**
     * Handle CHAT_SEND message
     * Calls business logic handler and formats response
     */
    private static handleChatSendMessage(
        connectionId: string,
        message: IChatSendMessage
    ): void {
        const result: TChatSendHandlerResult = handleChatSend(
            connectionManager,
            connectionId,
            message
        );

        if (!result.success) {
            // Send error to client
            WebSocketController.sendError(
                connectionId,
                result.code,
                result.message
            );
            return;
        }

        // Broadcast CHAT_RECEIVE to ALL participants
        connectionManager.broadcastToRoom(result.roomId, {
            type: EWSMessageType.ChatReceive,
            data: {
                message: result.message,
            },
            timestamp: Date.now(),
        });
    }

    /**
     * Handle connection disconnect
     * Cleans up connection and updates room state
     */
    static handleDisconnect(connectionId: string): void {
        console.log(
            `[WebSocketController] Client disconnected: ${connectionId}`
        );
        connectionManager.handleDisconnect(connectionId);
    }

    /**
     * Send error message to connection
     * Helper method for formatting error responses
     */
    private static sendError(
        connectionId: string,
        code: EWSErrorCode,
        message: string
    ): void {
        connectionManager.sendToConnection(connectionId, {
            type: EWSMessageType.Error,
            data: {
                code,
                message,
            },
            timestamp: Date.now(),
        });
    }

    /**
     * Convert RawData to text
     * Helper method for parsing WebSocket data
     */
    private static rawDataToText(data: RawData): string {
        if (Buffer.isBuffer(data)) {
            return data.toString('utf-8');
        }
        if (Array.isArray(data)) {
            return Buffer.concat(data).toString('utf-8');
        }
        // ArrayBuffer case
        return Buffer.from(data).toString('utf-8');
    }
}
