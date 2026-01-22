/**
 * Room CRUD Service
 * Pure CRUD operations for room data access
 *
 * ARCHITECTURE: Data Access Service
 * - Handles Create, Read, Update, Delete operations
 * - Will integrate with Repository layer when database is added
 * - No business logic, only data operations
 *
 * FUTURE: This will call RoomRepository instead of RoomManager
 */

import type { IRoom } from '../../../models/entities/room';

/**
 * CRUD Service for Room entity
 *
 * NOTE: Currently delegates to RoomManager (in-memory)
 * TODO: Integrate with RoomRepository when database is added
 */
export class RoomCrudService {
    /**
     * Create a new room
     * FUTURE: roomRepository.create(data)
     */
    create(_data: Partial<IRoom>): Promise<IRoom> {
        // TODO: Replace with repository call
        return Promise.reject(
            new Error('Not implemented - waiting for database integration')
        );
    }

    /**
     * Find room by ID
     * FUTURE: roomRepository.findById(id)
     */
    findById(_roomId: string): Promise<IRoom | null> {
        // TODO: Replace with repository call
        return Promise.reject(
            new Error('Not implemented - waiting for database integration')
        );
    }

    /**
     * Find room by code
     * FUTURE: roomRepository.findByCode(code)
     */
    findByCode(_roomCode: string): Promise<IRoom | null> {
        // TODO: Replace with repository call
        return Promise.reject(
            new Error('Not implemented - waiting for database integration')
        );
    }

    /**
     * Update room
     * FUTURE: roomRepository.update(id, data)
     */
    update(_roomId: string, _data: Partial<IRoom>): Promise<IRoom> {
        // TODO: Replace with repository call
        return Promise.reject(
            new Error('Not implemented - waiting for database integration')
        );
    }

    /**
     * Delete room
     * FUTURE: roomRepository.delete(id)
     */
    delete(_roomId: string): Promise<boolean> {
        // TODO: Replace with repository call
        return Promise.reject(
            new Error('Not implemented - waiting for database integration')
        );
    }

    /**
     * Find all rooms matching filter
     * FUTURE: roomRepository.findAll(filter)
     */
    findAll(_filter?: Record<string, unknown>): Promise<IRoom[]> {
        // TODO: Replace with repository call
        return Promise.reject(
            new Error('Not implemented - waiting for database integration')
        );
    }
}

// Singleton instance
export const roomCrudService = new RoomCrudService();
