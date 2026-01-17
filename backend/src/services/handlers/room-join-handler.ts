/**
 * Room Join Message Handler
 */

import { MessageHandler } from '../../utils/message-handler';
import type { WSClient } from '../../utils/ws-client';
import type { IRoomJoinData } from '../../types/ws-messages';
import { MessageType } from '../../types/ws-messages';
import { gameRoomManager } from '../game-room-manager';
import { broadcastToRoom } from '../../ws';

export class RoomJoinHandler extends MessageHandler<IRoomJoinData> {
    async handle(
        client: WSClient,
        message: { data: IRoomJoinData }
    ): Promise<void> {
        try {
            const { roomId, playerName, playerAvatar } = message.data;

            if (!roomId || roomId.trim().length === 0) {
                this.sendError(
                    client,
                    'INVALID_ROOM_ID',
                    'Room ID is required'
                );
                return;
            }

            if (!playerName || playerName.trim().length === 0) {
                this.sendError(
                    client,
                    'INVALID_PLAYER_NAME',
                    'Player name is required'
                );
                return;
            }

            const { room, player } = gameRoomManager.joinRoom(
                roomId,
                playerName,
                playerAvatar
            );

            // Associate client with player and room
            client.playerId = player.id;
            client.roomId = room.id;

            // Send response to joining player
            client.send(MessageType.ROOM_JOINED, {
                room,
                player,
            });

            // Notify other players in the room
            broadcastToRoom(roomId, MessageType.PLAYER_JOINED, {
                player,
                room,
            });
        } catch (error) {
            console.error('Error joining room:', error);
            this.sendError(
                client,
                'ROOM_JOIN_FAILED',
                error instanceof Error ? error.message : 'Unknown error'
            );
        }
    }
}

export const roomJoinHandler = new RoomJoinHandler();
