/**
 * Room Create Message Handler
 */

import { MessageHandler } from '../../utils/message-handler';
import type { WSClient } from '../../utils/ws-client';
import type { IRoomCreateData } from '../../types/ws-messages';
import { MessageType } from '../../types/ws-messages';
import { gameRoomManager } from '../game-room-manager';
import { broadcastToRoom } from '../../ws';

export class RoomCreateHandler extends MessageHandler<IRoomCreateData> {
    async handle(
        client: WSClient,
        message: { data: IRoomCreateData }
    ): Promise<void> {
        try {
            const { playerName, playerAvatar } = message.data;

            if (!playerName || playerName.trim().length === 0) {
                this.sendError(
                    client,
                    'INVALID_PLAYER_NAME',
                    'Player name is required'
                );
                return;
            }

            const { room, player } = gameRoomManager.createRoom(
                playerName,
                playerAvatar
            );

            // Associate client with player and room
            client.playerId = player.id;
            client.roomId = room.id;

            // Send response to creator
            client.send(MessageType.ROOM_CREATED, {
                room,
                player,
            });
        } catch (error) {
            console.error('Error creating room:', error);
            this.sendError(
                client,
                'ROOM_CREATE_FAILED',
                error instanceof Error ? error.message : 'Unknown error'
            );
        }
    }
}

export const roomCreateHandler = new RoomCreateHandler();
