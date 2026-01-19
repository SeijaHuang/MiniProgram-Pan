/**
 * Room Manager Service
 * Manages room lifecycle and state transitions
 *
 * CRITICAL: This is a DOMAIN service - no WebSocket logic
 * CRITICAL: Enforces room state machine: WAITING → READY → CLOSED
 * CRITICAL: Enforces max 2 participants per room
 */

import { randomBytes } from 'crypto';
import type { IRoom, IParticipant } from '../models/room';
import type { IUser } from '../models/user';
import { ERoomStatus } from '../models/room';

export class RoomManager {
    private static instance: RoomManager;
    private rooms: Map<string, IRoom> = new Map();
    private roomCodeToId: Map<string, string> = new Map();

    private constructor() {}

    static getInstance(): RoomManager {
        if (!RoomManager.instance) {
            RoomManager.instance = new RoomManager();
        }
        return RoomManager.instance;
    }

    /**
     * Create a new room
     * CRITICAL: Room is created with WAITING status and creator as first participant
     */
    createRoom(creator: IUser): IRoom {
        const roomId = this.generateRoomId();
        const roomCode = this.generateRoomCode();
        const now = Date.now();

        const participant: IParticipant = {
            user: creator,
            joinedAt: now,
        };

        const room: IRoom = {
            roomId,
            roomCode,
            participants: [participant],
            status: ERoomStatus.Waiting,
            createdAt: now,
        };

        this.rooms.set(roomId, room);
        this.roomCodeToId.set(roomCode, roomId);

        console.log(
            `[RoomManager] Room created: ${roomId} (code: ${roomCode}) by user: ${creator.userId}`
        );

        return room;
    }

    /**
     * Get room by ID
     */
    getRoomById(roomId: string): IRoom | undefined {
        return this.rooms.get(roomId);
    }

    /**
     * Get room by room code
     */
    getRoomByCode(roomCode: string): IRoom | undefined {
        const roomId = this.roomCodeToId.get(roomCode);
        if (!roomId) {
            return undefined;
        }
        return this.rooms.get(roomId);
    }

    /**
     * Join a room
     * CRITICAL: Validates state transitions and participant limits
     *
     * Validations (in order):
     * 1. Room exists
     * 2. Room status allows joining (must be WAITING)
     * 3. Room is not full (max 2 participants)
     * 4. User is not already a participant
     *
     * State transition: WAITING → READY (when 2nd user joins)
     */
    joinRoom(
        roomCode: string,
        user: IUser
    ): { success: true; room: IRoom } | { success: false; error: string } {
        const room = this.getRoomByCode(roomCode);

        // Validation 1: Room exists
        if (!room) {
            return { success: false, error: 'ROOM_NOT_FOUND' };
        }

        // Validation 2: Room status allows joining
        if (room.status !== ERoomStatus.Waiting) {
            return { success: false, error: 'ROOM_CLOSED' };
        }

        // Validation 3: Room is not full
        if (room.participants.length >= 2) {
            return { success: false, error: 'ROOM_FULL' };
        }

        // Validation 4: User is not already a participant
        const isAlreadyParticipant = room.participants.some(
            p => p.user.userId === user.userId
        );
        if (isAlreadyParticipant) {
            return { success: false, error: 'ALREADY_JOINED' };
        }

        // Add participant
        const participant: IParticipant = {
            user,
            joinedAt: Date.now(),
        };
        room.participants.push(participant);

        // State transition: WAITING → READY
        if (room.participants.length === 2) {
            room.status = ERoomStatus.Ready;
            console.log(
                `[RoomManager] Room ${room.roomId} is now READY (2 participants)`
            );
        }

        console.log(
            `[RoomManager] User ${user.userId} joined room ${room.roomId}`
        );

        return { success: true, room };
    }

    /**
     * Remove participant from room
     * CRITICAL: Handles disconnect cleanup
     *
     * State transition:
     * - If all participants leave → CLOSED
     * - Room is marked for cleanup but not resurrected
     */
    leaveRoom(roomId: string, userId: string): IRoom | null {
        const room = this.rooms.get(roomId);

        if (!room) {
            return null;
        }

        // Remove participant
        room.participants = room.participants.filter(
            p => p.user.userId !== userId
        );

        console.log(
            `[RoomManager] User ${userId} left room ${roomId} (${room.participants.length} remaining)`
        );

        // If room becomes empty, close it
        if (room.participants.length === 0) {
            room.status = ERoomStatus.Closed;
            this.rooms.delete(roomId);
            this.roomCodeToId.delete(room.roomCode);
            console.log(
                `[RoomManager] Room ${roomId} CLOSED (no participants)`
            );
            return null;
        }

        return room;
    }

    /**
     * Check if user is participant of a room
     */
    isParticipant(roomId: string, userId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) {
            return false;
        }
        return room.participants.some(p => p.user.userId === userId);
    }

    /**
     * Get all rooms (for debugging/admin purposes)
     */
    getAllRooms(): IRoom[] {
        return Array.from(this.rooms.values());
    }

    /**
     * Generate unique room ID
     */
    private generateRoomId(): string {
        return `room_${randomBytes(16).toString('hex')}`;
    }

    /**
     * Generate 6-digit room code
     */
    private generateRoomCode(): string {
        // Generate a 6-digit numeric code
        let code: string;
        do {
            code = Math.floor(100000 + Math.random() * 900000).toString();
        } while (this.roomCodeToId.has(code));
        return code;
    }
}

export const roomManager = RoomManager.getInstance();
