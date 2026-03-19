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

export class RoomService {
    /**
     * Create a new room with business logic
     * Orchestrates: room creation + caching + event emission
     */
    createRoom(): IRoom {
        // Delegate to RoomManager (domain service)
        const room = roomManager.createRoom();

        // Future: Add caching
        // await cacheService.set(`room:${room.code}`, room);

        // Future: Emit event
        // eventEmitter.emit('room:created', room);

        return room;
    }
}

// Singleton instance
export const roomService = new RoomService();
