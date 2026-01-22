/**
 * Room Service
 * High-level business logic for room operations
 *
 * ARCHITECTURE: Core Business Service
 * - Orchestrates complex business workflows
 * - Delegates CRUD operations to RoomCrudService
 * - Handles cross-cutting concerns (caching, events, etc.)
 */

import { roomManager } from '../../websocket/room-manager';
import type { IRoom } from '../../../models/entities/room';
import type { IUser } from '../../../models/entities/user';

export class RoomService {
    /**
     * Create a new room with business logic
     * Orchestrates: room creation + caching + event emission
     */
    createRoom(hostUserId: string): IRoom {
        // Delegate to RoomManager (domain service)
        const room = roomManager.createRoom(hostUserId);

        // Future: Add caching
        // await cacheService.set(`room:${room.code}`, room);

        // Future: Emit event
        // eventEmitter.emit('room:created', room);

        return room;
    }

    /**
     * Join a room with business logic
     * Orchestrates: validation + join + notification
     */
    joinRoom(
        roomCode: string,
        user: IUser
    ): { success: true; room: IRoom } | { success: false; error: string } {
        // Delegate to RoomManager (domain service)
        const result = roomManager.joinRoom(roomCode, user);

        if (!result.success) {
            return result;
        }

        // Future: Notify other participants
        // notificationService.notifyRoomParticipants(result.room.roomId, ...);

        return result;
    }

    /**
     * Get room by code
     */
    getRoomByCode(roomCode: string): IRoom | undefined {
        return roomManager.getRoomByCode(roomCode);
    }

    /**
     * Get room by ID
     */
    getRoomById(roomId: string): IRoom | undefined {
        return roomManager.getRoomById(roomId);
    }
}

// Singleton instance
export const roomService = new RoomService();
