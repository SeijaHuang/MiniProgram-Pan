import type { ConnectionManager } from '../websocket/connection-manager';
import type { IEmojiMessage, IEmojiSendMessage } from '../../types/websocket';
import { EmojiMessageSchema } from '../../models/schemas/emoji-message.schema';
import { EWSErrorCode } from '../../types/websocket';
import { roomManager } from '../websocket/room-manager';
import { ERoomStatus } from '../../models/entities/room';

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
    const validation = EmojiMessageSchema.safeParse(message.data);
    if (!validation.success) {
        const firstError = validation.error.issues[0];
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: firstError?.message ?? 'Invalid payload',
        };
    }

    const { roomId, senderId, emoji } = validation.data;

    const connectionData = connectionManager.getConnection(connectionId);
    if (!connectionData || !connectionData.userId || !connectionData.roomId) {
        return {
            success: false,
            code: EWSErrorCode.NotParticipant,
            message: 'You must join a room first',
        };
    }

    if (connectionData.userId !== senderId) {
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: 'senderId must match your userId',
        };
    }

    if (connectionData.roomId !== roomId) {
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: 'roomId must match your current room',
        };
    }

    const room = roomManager.getRoomById(roomId);
    if (!room) {
        return {
            success: false,
            code: EWSErrorCode.RoomNotFound,
            message: 'Room not found',
        };
    }

    if (room.status !== ERoomStatus.Ready) {
        return {
            success: false,
            code: EWSErrorCode.RoomNotReady,
            message: 'Room is not ready (need 2 participants)',
        };
    }

    const sender = room.participants.find(p => p.user.userId === senderId);
    if (!sender) {
        return {
            success: false,
            code: EWSErrorCode.NotParticipant,
            message: 'You are not a participant of this room',
        };
    }

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
