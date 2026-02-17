import type { ConnectionManager } from '../websocket/connection-manager';
import type { IEmojiMessage, IEmojiSendMessage } from '../../types/websocket';
import { EmojiMessageSchema } from '../../models/schemas/emoji-message.schema';
import { EWSErrorCode } from '../../types/websocket';
import {
    validatePayload,
    validateConnection,
    validateReadyRoomParticipant,
} from './handler-utils';

export interface IEmojiTextResult {
    success: true;
    message: IEmojiMessage;
    roomId: string;
}

export interface IEmojiTextError {
    success: false;
    code: EWSErrorCode;
    message: string;
}

export type TEmojiTextHandlerResult = IEmojiTextResult | IEmojiTextError;

export function handleEmojiText(
    connectionManager: ConnectionManager,
    connectionId: string,
    message: IEmojiSendMessage
): TEmojiTextHandlerResult {
    // Validate payload schema
    const v = validatePayload(EmojiMessageSchema, message.data);
    if (!v.success) return v;

    const { roomId, senderId, emoji } = v.data;

    // Validate connection
    const conn = validateConnection(connectionManager, connectionId);
    if (!conn.success) return conn;

    // Verify senderId matches connection's userId
    if (conn.userId !== senderId) {
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: 'senderId must match your userId',
        };
    }

    // Verify roomId matches connection's roomId
    if (conn.roomId !== roomId) {
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: 'roomId must match your current room',
        };
    }

    // Validate room (READY) + participant
    const roomResult = validateReadyRoomParticipant(roomId, conn.userId);
    if (!roomResult.success) return roomResult;

    const emojiMessage: IEmojiMessage = {
        roomId,
        senderId,
        emoji,
    };

    console.log(
        `[EMOJI_TEXT] Message from ${senderId} in room ${roomId}: "${emoji}"`
    );

    return {
        success: true,
        message: emojiMessage,
        roomId,
    };
}
