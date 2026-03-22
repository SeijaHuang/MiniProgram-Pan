/**
 * Drum Game Manager Service
 * Manages drum game state and score tracking
 *
 * CRITICAL: This is a DOMAIN service - no WebSocket logic
 * CRITICAL: Enforces game state machine: WAITING → COUNTDOWN → RUNNING → FINISHED
 */

import type { IRoom } from '../../models/entities/room';
import type { IUser } from '../../models/entities/user';
import { EGamePhase } from '../../types/websocket/drum';
import { DRUM_CONFIG } from '../../constants/config';
import { logger } from '../../utils/logger';

/**
 * Drum Game State
 */
interface IDrumGameState {
    roomId: string;
    phase: EGamePhase;
    organizerUserId: string;
    joinerUserId: string;
    organizer: IUser;
    joiner: IUser;
    organizerScore: number;
    joinerScore: number;
    startAtMs: number;
    endAtMs: number;
    readyUserIds: Set<string>;
    firstToMaxUserId?: string;
}

/**
 * Game Result
 */
interface IDrumGameResult {
    scores: { [userId: string]: number };
    winnerUserId: string;
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
            organizerUserId: hostParticipant.user.userId,
            joinerUserId: joinerParticipant.user.userId,
            organizer: hostParticipant.user,
            joiner: joinerParticipant.user,
            organizerScore: 0,
            joinerScore: 0,
            startAtMs: 0,
            endAtMs: 0,
            readyUserIds: new Set<string>(),
        };

        this.games.set(roomId, game);

        logger.log(
            'DrumGameManager',
            `Game initialized: ${roomId} (Organizer: ${game.organizer.nickname}, Joiner: ${game.joiner.nickname})`
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
     * Get the number of players who have signalled ready.
     */
    getReadyCount(roomId: string): number {
        return this.games.get(roomId)?.readyUserIds.size ?? 0;
    }

    /**
     * Mark a player as ready to start the drum game.
     * Returns true when both players have signalled ready.
     */
    markPlayerReady(roomId: string, userId: string): boolean {
        const game = this.games.get(roomId);
        if (!game) {
            return false;
        }

        game.readyUserIds.add(userId);

        const totalPlayers: number = 2;
        const bothReady: boolean = game.readyUserIds.size >= totalPlayers;

        logger.log(
            'DrumGameManager',
            `Game ${roomId} ready: ${game.readyUserIds.size}/${totalPlayers} (userId: ${userId})`
        );

        return bothReady;
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
        logger.log('DrumGameManager', `Game ${roomId} phase: ${phase}`);

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
        userId: string,
        delta: number
    ): IDrumGameState | undefined {
        const game = this.games.get(roomId);
        if (!game) {
            return undefined;
        }

        if (game.phase !== EGamePhase.Running) {
            logger.warn(
                'DrumGameManager',
                `Ignoring tap for game ${roomId} - not running`
            );
            return game;
        }

        if (userId === game.organizerUserId) {
            game.organizerScore += delta;
        } else {
            game.joinerScore += delta;
        }

        // Record who first reaches MAX_TAPS (only once)
        if (game.firstToMaxUserId === undefined) {
            if (game.organizerScore >= DRUM_CONFIG.MAX_TAPS) {
                game.firstToMaxUserId = game.organizerUserId;
            } else if (game.joinerScore >= DRUM_CONFIG.MAX_TAPS) {
                game.firstToMaxUserId = game.joinerUserId;
            }
        }

        logger.log(
            'DrumGameManager',
            `Game ${roomId} tap: ${userId} +${delta} (Organizer: ${game.organizerScore}, Joiner: ${game.joinerScore})`
        );

        return game;
    }

    /**
     * Calculate game result
     * CRITICAL: Higher score wins, tie goes to host (organizerUserId)
     */
    calculateResult(roomId: string): IDrumGameResult | undefined {
        const game = this.games.get(roomId);
        if (!game) {
            return undefined;
        }

        let winnerUserId: string;

        if (game.firstToMaxUserId !== undefined) {
            // Someone reached MAX_TAPS — first to reach it wins
            winnerUserId = game.firstToMaxUserId;
        } else if (game.organizerScore > game.joinerScore) {
            winnerUserId = game.organizerUserId;
        } else if (game.joinerScore > game.organizerScore) {
            winnerUserId = game.joinerUserId;
        } else {
            // Tie: host (organizer) wins
            winnerUserId = game.organizerUserId;
        }

        game.phase = EGamePhase.Finished;

        logger.log(
            'DrumGameManager',
            `Game ${roomId} result: ${winnerUserId} wins (${game.organizerUserId}: ${game.organizerScore}, ${game.joinerUserId}: ${game.joinerScore})`
        );

        return {
            scores: {
                [game.organizerUserId]: game.organizerScore,
                [game.joinerUserId]: game.joinerScore,
            },
            winnerUserId,
        };
    }

    /**
     * Cleanup game
     */
    cleanupGame(roomId: string): void {
        const game = this.games.get(roomId);
        if (game) {
            this.games.delete(roomId);
            logger.log('DrumGameManager', `Game ${roomId} cleaned up`);
        }
    }
}

export const drumGameManager = DrumGameManager.getInstance();
