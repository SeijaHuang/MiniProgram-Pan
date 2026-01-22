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
import type { IChatSendMessage } from '../../types/ws-messages';
import { EWSErrorCode } from '../../types/ws-messages';
import { roomManager } from '../websocket/room-manager';
import { ERoomStatus } from '../../models/entities/room';
import type { IMessage } from '../../models/entities/message';
import { EMessageType } from '../../models/entities/message';
import type { ConnectionManager } from '../websocket/connection-manager';

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
    const { content } = message.data;

    // Get connection metadata
    const connectionData = connectionManager.getConnection(connectionId);
    if (
        !connectionData ||
        !connectionData.userId ||
        !connectionData.roomId
    ) {
        return {
            success: false,
            code: EWSErrorCode.NotParticipant,
            message: 'You must join a room first',
        };
    }

    const { userId, roomId } = connectionData;

    // Validation: Room exists
    const room = roomManager.getRoomById(roomId);
    if (!room) {
        return {
            success: false,
            code: EWSErrorCode.RoomNotFound,
            message: 'Room not found',
        };
    }

    // Validation: Room status is READY
    if (room.status !== ERoomStatus.Ready) {
        return {
            success: false,
            code: EWSErrorCode.RoomNotReady,
            message: 'Room is not ready for chat (need 2 participants)',
        };
    }

    // Validation: Sender is a participant
    const sender = room.participants.find(p => p.user.userId === userId);
    if (!sender) {
        return {
            success: false,
            code: EWSErrorCode.NotParticipant,
            message: 'You are not a participant of this room',
        };
    }

    // Validation: Content is valid
    if (!content || !content.text || content.type !== EMessageType.Text) {
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: 'Invalid message content',
        };
    }

    // Create message
    const chatMessage: IMessage = {
        messageId: `msg_${randomBytes(8).toString('hex')}`,
        roomId: room.roomId,
        sender: sender.user,
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
