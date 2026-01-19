/**
 * CHAT_SEND Message Handler
 * Handles chat message sending
 *
 * CRITICAL: Only allows chat in READY rooms
 * CRITICAL: Validates sender is a participant
 * CRITICAL: Broadcasts to all participants
 */

import { randomBytes } from 'crypto';
import type { IChatSendMessage } from '../../types/ws-messages';
import { EWSMessageType, EWSErrorCode } from '../../types/ws-messages';
import { roomManager } from '../room-manager';
import { ERoomStatus } from '../../models/room';
import type { IMessage } from '../../models/message';
import { EMessageType } from '../../models/message';
import type { ConnectionManager } from '../connection-manager';

export function handleChatSend(
    connectionManager: ConnectionManager,
    connectionId: string,
    message: IChatSendMessage
): void {
    try {
        const { content } = message.data;

        // Get connection metadata
        const connectionData = connectionManager.getConnection(connectionId);
        if (
            !connectionData ||
            !connectionData.userId ||
            !connectionData.roomId
        ) {
            connectionManager.sendToConnection(connectionId, {
                type: EWSMessageType.Error,
                data: {
                    code: EWSErrorCode.NotParticipant,
                    message: 'You must join a room first',
                },
                timestamp: Date.now(),
            });
            return;
        }

        const { userId, roomId } = connectionData;

        // Validation: Room exists
        const room = roomManager.getRoomById(roomId);
        if (!room) {
            connectionManager.sendToConnection(connectionId, {
                type: EWSMessageType.Error,
                data: {
                    code: EWSErrorCode.RoomNotFound,
                    message: 'Room not found',
                },
                timestamp: Date.now(),
            });
            return;
        }

        // Validation: Room status is READY
        if (room.status !== ERoomStatus.Ready) {
            connectionManager.sendToConnection(connectionId, {
                type: EWSMessageType.Error,
                data: {
                    code: EWSErrorCode.RoomNotReady,
                    message: 'Room is not ready for chat (need 2 participants)',
                },
                timestamp: Date.now(),
            });
            return;
        }

        // Validation: Sender is a participant
        const sender = room.participants.find(p => p.user.userId === userId);
        if (!sender) {
            connectionManager.sendToConnection(connectionId, {
                type: EWSMessageType.Error,
                data: {
                    code: EWSErrorCode.NotParticipant,
                    message: 'You are not a participant of this room',
                },
                timestamp: Date.now(),
            });
            return;
        }

        // Validation: Content is valid
        if (!content || !content.text || content.type !== EMessageType.Text) {
            connectionManager.sendToConnection(connectionId, {
                type: EWSMessageType.Error,
                data: {
                    code: EWSErrorCode.InvalidPayload,
                    message: 'Invalid message content',
                },
                timestamp: Date.now(),
            });
            return;
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

        // Broadcast to all participants
        connectionManager.broadcastToRoom(roomId, {
            type: EWSMessageType.ChatReceive,
            data: {
                message: chatMessage,
            },
            timestamp: Date.now(),
        });

        console.log(
            `[CHAT_SEND] Message from ${userId} in room ${roomId}: "${content.text}"`
        );
    } catch (error) {
        console.error('[CHAT_SEND] Error:', error);
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
