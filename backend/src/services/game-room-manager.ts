/**
 * Game Room Manager Service
 * Manages game rooms, players, and game state
 */

import type { IGameRoom, IGameMove, GameResult } from '../models/game';
import type { IPlayer } from '../models/player';
import { GameState } from '../models/game';
import { GAME_CONFIG } from '../constants/config';
import {
    generateRoomId,
    generatePlayerId,
} from '../utils/ws-utils';

export class GameRoomManager {
    private static instance: GameRoomManager;
    private rooms: Map<string, IGameRoom> = new Map();

    private constructor() {}

    static getInstance(): GameRoomManager {
        if (!GameRoomManager.instance) {
            GameRoomManager.instance = new GameRoomManager();
        }
        return GameRoomManager.instance;
    }

    /**
     * Create a new game room
     */
    createRoom(playerName: string, playerAvatar?: string): {
        room: IGameRoom;
        player: IPlayer;
    } {
        const roomId = generateRoomId();
        const playerId = generatePlayerId();

        const player: IPlayer = {
            id: playerId,
            name: playerName,
            avatar: playerAvatar,
            isReady: false,
            isOnline: true,
            score: 0,
            joinedAt: new Date(),
            lastHeartbeat: new Date(),
        };

        const room: IGameRoom = {
            id: roomId,
            state: GameState.WAITING,
            players: [player],
            currentTurn: null,
            winner: null,
            result: null,
            moveHistory: [],
            createdAt: new Date(),
            startedAt: null,
            finishedAt: null,
            lastActivityAt: new Date(),
        };

        this.rooms.set(roomId, room);
        console.log(`Room created: ${roomId} by player: ${playerName}`);

        return { room, player };
    }

    /**
     * Join an existing room
     */
    joinRoom(roomId: string, playerName: string, playerAvatar?: string): {
        room: IGameRoom;
        player: IPlayer;
    } {
        const room = this.rooms.get(roomId);

        if (!room) {
            throw new Error(`Room ${roomId} not found`);
        }

        if (room.state !== GameState.WAITING) {
            throw new Error(`Room ${roomId} is not accepting new players`);
        }

        if (room.players.length >= GAME_CONFIG.MAX_PLAYERS_PER_ROOM) {
            throw new Error(`Room ${roomId} is full`);
        }

        const playerId = generatePlayerId();
        const player: IPlayer = {
            id: playerId,
            name: playerName,
            avatar: playerAvatar,
            isReady: false,
            isOnline: true,
            score: 0,
            joinedAt: new Date(),
            lastHeartbeat: new Date(),
        };

        room.players.push(player);
        room.lastActivityAt = new Date();

        console.log(
            `Player ${playerName} joined room: ${roomId}`
        );

        return { room, player };
    }

    /**
     * Remove player from room
     */
    leaveRoom(roomId: string, playerId: string): IGameRoom | null {
        const room = this.rooms.get(roomId);

        if (!room) {
            return null;
        }

        room.players = room.players.filter((p) => p.id !== playerId);
        room.lastActivityAt = new Date();

        // Delete room if empty
        if (room.players.length === 0) {
            this.rooms.delete(roomId);
            console.log(`Room ${roomId} deleted (no players)`);
            return null;
        }

        console.log(`Player ${playerId} left room: ${roomId}`);
        return room;
    }

    /**
     * Mark player as ready
     */
    setPlayerReady(roomId: string, playerId: string): IGameRoom {
        const room = this.rooms.get(roomId);

        if (!room) {
            throw new Error(`Room ${roomId} not found`);
        }

        const player = room.players.find((p) => p.id === playerId);

        if (!player) {
            throw new Error(
                `Player ${playerId} not found in room ${roomId}`
            );
        }

        player.isReady = true;
        room.lastActivityAt = new Date();

        // Check if all players are ready
        if (this.areAllPlayersReady(room)) {
            this.startGame(room);
        }

        return room;
    }

    /**
     * Start the game
     */
    private startGame(room: IGameRoom): void {
        if (room.players.length < GAME_CONFIG.MAX_PLAYERS_PER_ROOM) {
            throw new Error('Not enough players to start game');
        }

        room.state = GameState.PLAYING;
        room.startedAt = new Date();
        room.currentTurn = room.players[0].id;
        room.lastActivityAt = new Date();

        console.log(`Game started in room: ${room.id}`);
    }

    /**
     * Make a move in the game
     */
    makeMove(
        roomId: string,
        playerId: string,
        x: number,
        y: number
    ): { room: IGameRoom; move: IGameMove } {
        const room = this.rooms.get(roomId);

        if (!room) {
            throw new Error(`Room ${roomId} not found`);
        }

        if (room.state !== GameState.PLAYING) {
            throw new Error(`Game in room ${roomId} is not in progress`);
        }

        if (room.currentTurn !== playerId) {
            throw new Error(`It's not player ${playerId}'s turn`);
        }

        const move: IGameMove = {
            playerId,
            x,
            y,
            timestamp: new Date(),
            moveNumber: room.moveHistory.length + 1,
        };

        room.moveHistory.push(move);
        room.lastActivityAt = new Date();

        // Switch turns
        const currentPlayerIndex = room.players.findIndex(
            (p) => p.id === playerId
        );
        const nextPlayerIndex =
            (currentPlayerIndex + 1) % room.players.length;
        room.currentTurn = room.players[nextPlayerIndex].id;

        console.log(
            `Move made in room ${roomId}: ${playerId} -> (${x}, ${y})`
        );

        return { room, move };
    }

    /**
     * End the game
     */
    endGame(
        roomId: string,
        winnerId: string | null,
        result: GameResult
    ): IGameRoom {
        const room = this.rooms.get(roomId);

        if (!room) {
            throw new Error(`Room ${roomId} not found`);
        }

        room.state = GameState.FINISHED;
        room.winner = winnerId;
        room.result = result;
        room.finishedAt = new Date();
        room.lastActivityAt = new Date();

        console.log(`Game ended in room ${roomId}, winner: ${winnerId}`);

        return room;
    }

    /**
     * Get room by ID
     */
    getRoom(roomId: string): IGameRoom | undefined {
        return this.rooms.get(roomId);
    }

    /**
     * Get all rooms
     */
    getAllRooms(): IGameRoom[] {
        return Array.from(this.rooms.values());
    }

    /**
     * Get available rooms (waiting for players)
     */
    getAvailableRooms(): IGameRoom[] {
        return Array.from(this.rooms.values()).filter(
            (room) =>
                room.state === GameState.WAITING &&
                room.players.length < GAME_CONFIG.MAX_PLAYERS_PER_ROOM
        );
    }

    /**
     * Update player heartbeat
     */
    updatePlayerHeartbeat(roomId: string, playerId: string): void {
        const room = this.rooms.get(roomId);

        if (!room) {
            return;
        }

        const player = room.players.find((p) => p.id === playerId);

        if (player) {
            player.lastHeartbeat = new Date();
        }
    }

    /**
     * Mark player as disconnected
     */
    setPlayerDisconnected(roomId: string, playerId: string): IGameRoom | null {
        const room = this.rooms.get(roomId);

        if (!room) {
            return null;
        }

        const player = room.players.find((p) => p.id === playerId);

        if (player) {
            player.isOnline = false;
            room.lastActivityAt = new Date();
        }

        return room;
    }

    /**
     * Mark player as reconnected
     */
    setPlayerReconnected(roomId: string, playerId: string): IGameRoom | null {
        const room = this.rooms.get(roomId);

        if (!room) {
            return null;
        }

        const player = room.players.find((p) => p.id === playerId);

        if (player) {
            player.isOnline = true;
            player.lastHeartbeat = new Date();
            room.lastActivityAt = new Date();
        }

        return room;
    }

    /**
     * Clean up old rooms
     */
    cleanupInactiveRooms(): void {
        const now = Date.now();
        let removedCount = 0;

        this.rooms.forEach((room, roomId) => {
            const inactiveTime =
                now - room.lastActivityAt.getTime();

            if (inactiveTime > GAME_CONFIG.ROOM_TIMEOUT) {
                this.rooms.delete(roomId);
                removedCount++;
                console.log(
                    `Removed inactive room: ${roomId}`
                );
            }
        });

        if (removedCount > 0) {
            console.log(
                `Cleaned up ${removedCount} inactive rooms`
            );
        }
    }

    /**
     * Check if all players in room are ready
     */
    private areAllPlayersReady(room: IGameRoom): boolean {
        if (room.players.length < GAME_CONFIG.MAX_PLAYERS_PER_ROOM) {
            return false;
        }

        return room.players.every((player) => player.isReady);
    }
}

export const gameRoomManager = GameRoomManager.getInstance();
