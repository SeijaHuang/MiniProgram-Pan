/**
 * Drum Game Manager Service
 * Manages drum game state and score tracking
 *
 * CRITICAL: This is a DOMAIN service - no WebSocket logic
 * CRITICAL: Enforces game state machine: WAITING → COUNTDOWN → RUNNING → FINISHED
 */

import type { IRoom } from '../../models/entities/room';
import type { IUser } from '../../models/entities/user';
import { EPlayerRole, EGamePhase } from '../../types/websocket/drum';

/**
 * Drum Game State
 */
export interface IDrumGameState {
    roomId: string;
    phase: EGamePhase;
    hostRole: EPlayerRole;
    organizer: IUser;
    joiner: IUser;
    organizerScore: number;
    joinerScore: number;
    startAtMs: number;
    endAtMs: number;
}

/**
 * Game Result
 */
export interface IDrumGameResult {
    organizerScore: number;
    joinerScore: number;
    winnerRole: EPlayerRole;
}

export class DrumGameManager {
    private static instance: DrumGameManager;
    private games: Map<string, IDrumGameState> = new Map();

    private constructor() {}

    static getInstance(): DrumGameManager {
        if (!DrumGameManager.instance) {
            DrumGameManager.instance = new DrumGameManager();
        }
        return DrumGameManager.instance;
    }

    /**
     * Initialize a new drum game
     * CRITICAL: First participant (host) is Organizer
     */
    initGame(room: IRoom): IDrumGameState {
        const { roomId } = room;

        // Determine roles: host is always Organizer
        const hostParticipant = room.participants.find(
            p => p.user.userId === room.hostUserId
        );
        const joinerParticipant = room.participants.find(
            p => p.user.userId !== room.hostUserId
        );

        if (!hostParticipant || !joinerParticipant) {
            throw new Error('Room must have exactly 2 participants');
        }

        const game: IDrumGameState = {
            roomId,
            phase: EGamePhase.Waiting,
            hostRole: EPlayerRole.Organizer,
            organizer: hostParticipant.user,
            joiner: joinerParticipant.user,
            organizerScore: 0,
            joinerScore: 0,
            startAtMs: 0,
            endAtMs: 0,
        };

        this.games.set(roomId, game);

        console.log(
            `[DrumGameManager] Game initialized: ${roomId} (Organizer: ${game.organizer.nickname}, Joiner: ${game.joiner.nickname})`
        );

        return game;
    }

    /**
     * Get game by room ID
     */
    getGame(roomId: string): IDrumGameState | undefined {
        return this.games.get(roomId);
    }

    /**
     * Update game phase
     */
    setPhase(roomId: string, phase: EGamePhase): IDrumGameState | undefined {
        const game = this.games.get(roomId);
        if (!game) {
            return undefined;
        }

        game.phase = phase;
        console.log(`[DrumGameManager] Game ${roomId} phase: ${phase}`);

        return game;
    }

    /**
     * Set game timing
     */
    setTiming(
        roomId: string,
        startAtMs: number,
        endAtMs: number
    ): IDrumGameState | undefined {
        const game = this.games.get(roomId);
        if (!game) {
            return undefined;
        }

        game.startAtMs = startAtMs;
        game.endAtMs = endAtMs;

        return game;
    }

    /**
     * Record tap and accumulate score
     */
    recordTap(
        roomId: string,
        role: EPlayerRole,
        delta: number
    ): IDrumGameState | undefined {
        const game = this.games.get(roomId);
        if (!game) {
            return undefined;
        }

        if (game.phase !== EGamePhase.Running) {
            console.warn(
                `[DrumGameManager] Ignoring tap for game ${roomId} - not running`
            );
            return game;
        }

        if (role === EPlayerRole.Organizer) {
            game.organizerScore += delta;
        } else {
            game.joinerScore += delta;
        }

        console.log(
            `[DrumGameManager] Game ${roomId} tap: ${role} +${delta} (Organizer: ${game.organizerScore}, Joiner: ${game.joinerScore})`
        );

        return game;
    }

    /**
     * Calculate game result
     * CRITICAL: Higher score wins, tie goes to host (Organizer)
     */
    calculateResult(roomId: string): IDrumGameResult | undefined {
        const game = this.games.get(roomId);
        if (!game) {
            return undefined;
        }

        let winnerRole: EPlayerRole;

        if (game.organizerScore > game.joinerScore) {
            winnerRole = EPlayerRole.Organizer;
        } else if (game.joinerScore > game.organizerScore) {
            winnerRole = EPlayerRole.Joiner;
        } else {
            // Tie: host (Organizer) wins
            winnerRole = EPlayerRole.Organizer;
        }

        game.phase = EGamePhase.Finished;

        console.log(
            `[DrumGameManager] Game ${roomId} result: ${winnerRole} wins (Organizer: ${game.organizerScore}, Joiner: ${game.joinerScore})`
        );

        return {
            organizerScore: game.organizerScore,
            joinerScore: game.joinerScore,
            winnerRole,
        };
    }

    /**
     * Cleanup game
     */
    cleanupGame(roomId: string): void {
        const game = this.games.get(roomId);
        if (game) {
            this.games.delete(roomId);
            console.log(`[DrumGameManager] Game ${roomId} cleaned up`);
        }
    }

    /**
     * Get all games (for debugging/admin purposes)
     */
    getAllGames(): IDrumGameState[] {
        return Array.from(this.games.values());
    }
}

export const drumGameManager = DrumGameManager.getInstance();
