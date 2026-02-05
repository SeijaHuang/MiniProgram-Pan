/**
 * Chat Service
 * Handles text message sending and receiving via WebSocket
 *
 * Responsibilities:
 * - Send text messages
 * - Receive and parse CHAT_RECEIVE messages
 * - Handle chat-related errors
 */

import { EMessageType, type IMessage } from '../models/message';
import type {
    IChatSendMessage,
    IChatReceiveMessage,
} from '../types/chat-websocket';
import {
    EWSMessageType,
    EWSErrorCode,
    type IErrorMessage,
} from '../types/websocket-common';

import { wsManager } from './websocket-manager';

type ChatReceiveHandler = (message: IMessage) => void;
type ChatErrorHandler = (code: EWSErrorCode, message: string) => void;

class ChatService {
    private chatReceiveHandler: ChatReceiveHandler | null = null;
    private chatErrorHandler: ChatErrorHandler | null = null;

    /**
     * Initialize chat service
     */
    initialize(
        onChatReceive: ChatReceiveHandler,
        onError: ChatErrorHandler
    ): void {
        this.chatReceiveHandler = onChatReceive;
        this.chatErrorHandler = onError;

        wsManager.updateCallbacks({
            onMessage: (data: string) => {
                this.handleMessage(data);
            },
        });
    }

    /**
     * Send a text message
     */
    sendTextMessage(text: string): void {
        if (!wsManager.isConnected()) {
            console.error('[ChatService] Not connected');
            return;
        }

        const message: IChatSendMessage = {
            type: EWSMessageType.ChatSend,
            data: {
                content: {
                    type: EMessageType.Text,
                    text,
                },
            },
            timestamp: Date.now(),
        };

        wsManager.send(message);
        console.log('[ChatService] Sent text message:', text);
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleMessage(data: string): void {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case EWSMessageType.ChatReceive:
                    this.handleChatReceive(message as IChatReceiveMessage);
                    break;
                case EWSMessageType.Error:
                    this.handleError(message as IErrorMessage);
                    break;
                // JOIN_ACK is handled by room-websocket-service
            }
        } catch (error) {
            console.error('[ChatService] Failed to parse message:', error);
        }
    }

    /**
     * Handle CHAT_RECEIVE message
     */
    private handleChatReceive(message: IChatReceiveMessage): void {
        console.log('[ChatService] CHAT_RECEIVE:', message.data);

        if (this.chatReceiveHandler) {
            this.chatReceiveHandler(message.data.message);
        }
    }

    /**
     * Handle ERROR message
     */
    private handleError(message: IErrorMessage): void {
        console.error('[ChatService] Error from server:', message.data);

        if (this.chatErrorHandler) {
            this.chatErrorHandler(message.data.code, message.data.message);
        }
    }
}

// Export singleton instance
export const chatService = new ChatService();
