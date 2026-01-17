/**
 * Player model
 * Represents a player in the game
 */

export interface IPlayer {
    id: string;
    name: string;
    avatar?: string;
    isReady: boolean;
    isOnline: boolean;
    score: number;
    joinedAt: Date;
    lastHeartbeat: Date;
}

export type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'disconnected';

export interface IPlayerState {
    player: IPlayer;
    status: PlayerStatus;
}
