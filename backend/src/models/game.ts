/**
 * Game room model
 * Represents a game room with players and game state
 */

import type { IPlayer } from './player';

export enum GameState {
    WAITING = 'waiting',
    READY = 'ready',
    PLAYING = 'playing',
    PAUSED = 'paused',
    FINISHED = 'finished',
}

export enum GameResult {
    PLAYER1_WIN = 'player1_win',
    PLAYER2_WIN = 'player2_win',
    DRAW = 'draw',
    ABANDONED = 'abandoned',
}

export interface IGameRoom {
    id: string;
    state: GameState;
    players: IPlayer[];
    currentTurn: string | null;
    winner: string | null;
    result: GameResult | null;
    moveHistory: IGameMove[];
    createdAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
    lastActivityAt: Date;
}

export interface IGameMove {
    playerId: string;
    x: number;
    y: number;
    timestamp: Date;
    moveNumber: number;
}

export interface IGameRoomOptions {
    maxPlayers?: number;
    timeLimit?: number;
    moveTimeout?: number;
}
