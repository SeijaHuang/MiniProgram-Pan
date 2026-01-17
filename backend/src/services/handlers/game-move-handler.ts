/**
 * Game Move Message Handler
 */

import { MessageHandler } from '../../utils/message-handler';
import type { WSClient } from '../../utils/ws-client';
import type { IGameMoveData } from '../../types/ws-messages';
import { MessageType } from '../../types/ws-messages';
import { gameRoomManager } from '../game-room-manager';
import { broadcastToRoom } from '../../ws';

export class GameMoveHandler extends MessageHandler<IGameMoveData> {
    async handle(
        client: WSClient,
        message: { data: IGameMoveData }
    ): Promise<void> {
        try {
            if (!client.roomId || !client.playerId) {
                this.sendError(
                    client,
                    'NOT_IN_ROOM',
                    'You must be in a room to make a move'
                );
                return;
            }

            const { x, y } = message.data;

            if (
                typeof x !== 'number' ||
                typeof y !== 'number' ||
                x < 0 ||
                y < 0
            ) {
                this.sendError(
                    client,
                    'INVALID_MOVE',
                    'Invalid move coordinates'
                );
                return;
            }

            const { room, move } = gameRoomManager.makeMove(
                client.roomId,
                client.playerId,
                x,
                y
            );

            // Broadcast move to all players in room
            broadcastToRoom(client.roomId, MessageType.GAME_UPDATE, {
                room,
                lastMove: move,
            });

            // TODO: Check for win condition and end game if needed
        } catch (error) {
            console.error('Error making move:', error);
            this.sendError(
                client,
                'MOVE_FAILED',
                error instanceof Error ? error.message : 'Unknown error'
            );
        }
    }
}

export const gameMoveHandler = new GameMoveHandler();
