/**
 * CHAT_SEND Business Logic Handler
 * Handles chat message business logic
 *
 * ARCHITECTURE: Business logic layer
 * - Validates chat preconditions
 * - Creates message entity
 * - Returns result (success/error)
 * - Does NOT format or send WebSocket messages
 */

import { randomBytes } from 'crypto';
import type { IChatSendMessage } from '../../types/websocket';
import { EWSErrorCode } from '../../types/websocket';
import type { IMessage } from '../../models/entities/message';
import { EMessageType } from '../../models/entities/message';
import type { ConnectionManager } from '../websocket/connection-manager';
import { ChatSendDataSchema } from '../../models/schemas/ws-message.schema';
import { validatePayload, validateRoomContext } from './handler-utils';

export interface IChatSendResult {
    success: true;
    message: IMessage;
    roomId: string;
}

export interface IChatSendError {
    success: false;
    code: EWSErrorCode;
    message: string;
}

export type TChatSendHandlerResult = IChatSendResult | IChatSendError;

export function handleChatSend(
    connectionManager: ConnectionManager,
    connectionId: string,
    message: IChatSendMessage
): TChatSendHandlerResult {
    // Validate payload schema
    const v = validatePayload(ChatSendDataSchema, message.data);
    if (!v.success) return v;

    const { content } = v.data;

    // Validate connection + room (READY) + participant
    const ctx = validateRoomContext(connectionManager, connectionId);
    if (!ctx.success) return ctx;

    const { userId, room, participant } = ctx;
    const roomId: string = room.roomId;

    // Create message
    const chatMessage: IMessage = {
        messageId: `msg_${randomBytes(8).toString('hex')}`,
        roomId: room.roomId,
        sender: participant.user,
        type: EMessageType.Text,
        content: content,
        createdAt: Date.now(),
    };

    console.log(
        `[CHAT_SEND] Message from ${userId} in room ${roomId}: "${content.text}"`
    );

    return {
        success: true,
        message: chatMessage,
        roomId,
    };
}
