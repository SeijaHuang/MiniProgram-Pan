/**
 * Player Ready Message Handler
 */

import { MessageHandler } from '../../utils/message-handler';
import type { WSClient } from '../../utils/ws-client';
import type { IPlayerReadyData } from '../../types/ws-messages';
import { MessageType } from '../../types/ws-messages';
import { gameRoomManager } from '../game-room-manager';
import { broadcastToRoom } from '../../ws';
import { GameState } from '../../models/game';

export class PlayerReadyHandler extends MessageHandler<IPlayerReadyData> {
    async handle(
        client: WSClient,
        message: { data: IPlayerReadyData }
    ): Promise<void> {
        try {
            if (!client.roomId || !client.playerId) {
                this.sendError(
                    client,
                    'NOT_IN_ROOM',
                    'You must be in a room to mark ready'
                );
                return;
            }

            const room = gameRoomManager.setPlayerReady(
                client.roomId,
                client.playerId
            );

            // Notify all players in room
            broadcastToRoom(client.roomId, MessageType.PLAYER_READY, {
                playerId: client.playerId,
            });

            // If game started, notify all players
            if (room.state === GameState.PLAYING) {
                broadcastToRoom(client.roomId, MessageType.GAME_START, {
                    room,
                    startingPlayer: room.currentTurn,
                });
            }
        } catch (error) {
            console.error('Error setting player ready:', error);
            this.sendError(
                client,
                'PLAYER_READY_FAILED',
                error instanceof Error ? error.message : 'Unknown error'
            );
        }
    }
}

export const playerReadyHandler = new PlayerReadyHandler();
