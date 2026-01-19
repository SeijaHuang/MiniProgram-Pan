/**
 * JOIN_ROOM Message Handler
 * Handles room join requests via WebSocket
 *
 * CRITICAL: Validates all preconditions before allowing join
 * CRITICAL: Broadcasts JOIN_ACK to ALL participants on success
 */

import type { IJoinRoomMessage } from '../../types/ws-messages';
import { EWSMessageType, EWSErrorCode } from '../../types/ws-messages';
import { roomManager } from '../room-manager';
import type { ConnectionManager } from '../connection-manager';

export function handleJoinRoom(
    connectionManager: ConnectionManager,
    connectionId: string,
    message: IJoinRoomMessage
): void {
    try {
        const { roomCode, user } = message.data;

        // Validation 1: Payload schema is valid
        if (!roomCode || !user || !user.userId || !user.nickname) {
            connectionManager.sendToConnection(connectionId, {
                type: EWSMessageType.Error,
                data: {
                    code: EWSErrorCode.InvalidPayload,
                    message:
                        'roomCode, user.userId, and user.nickname are required',
                },
                timestamp: Date.now(),
            });
            return;
        }

        // Check if user is already a participant (e.g., room creator)
        const room = roomManager.getRoomByCode(roomCode);
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

        const isAlreadyParticipant = room.participants.some(
            p => p.user.userId === user.userId
        );

        let finalRoom = room;

        if (isAlreadyParticipant) {
            // User is already a participant, just bind the WebSocket connection
            console.log(
                `[JOIN_ROOM] User ${user.userId} is already a participant, binding WebSocket connection`
            );
        } else {
            // User is not a participant, try to join
            const result = roomManager.joinRoom(roomCode, user);

            if (!result.success) {
                // Map domain errors to WebSocket error codes
                const errorCodeMap: Record<string, EWSErrorCode> = {
                    ROOM_NOT_FOUND: EWSErrorCode.RoomNotFound,
                    ROOM_CLOSED: EWSErrorCode.RoomClosed,
                    ROOM_FULL: EWSErrorCode.RoomFull,
                    ALREADY_JOINED: EWSErrorCode.AlreadyJoined,
                };

                const errorCode =
                    errorCodeMap[result.error] || EWSErrorCode.InternalError;

                connectionManager.sendToConnection(connectionId, {
                    type: EWSMessageType.Error,
                    data: {
                        code: errorCode,
                        message: result.error,
                    },
                    timestamp: Date.now(),
                });
                return;
            }

            finalRoom = result.room;
        }

        // Bind connection to user and room
        connectionManager.bindConnection(
            connectionId,
            user.userId,
            finalRoom.roomId
        );

        // Broadcast JOIN_ACK to ALL participants
        const joinAckMessage = {
            type: EWSMessageType.JoinAck,
            data: {
                room: finalRoom,
            },
            timestamp: Date.now(),
        };

        connectionManager.broadcastToRoom(finalRoom.roomId, joinAckMessage);

        console.log(
            `[JOIN_ROOM] User ${user.userId} connected to room ${finalRoom.roomId} (${finalRoom.participants.length}/2)`
        );
    } catch (error) {
        console.error('[JOIN_ROOM] Error:', error);
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
