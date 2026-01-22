/**
 * Room Repository Interface
 * Defines room-specific data access operations
 *
 * ARCHITECTURE: Data Access Layer
 * - Extends base repository with room-specific methods
 * - Will be implemented when database is integrated
 */

import type { IRoom } from '../../models/entities/room';
import type { IBaseRepository } from '../base/base.repository.interface';

/**
 * Room repository interface
 * Extends base repository with room-specific queries
 */
export interface IRoomRepository extends IBaseRepository<IRoom> {
    /**
     * Find room by room code
     */
    findByCode(code: string): Promise<IRoom | null>;

    /**
     * Find active rooms (not closed)
     */
    findActiveRooms(): Promise<IRoom[]>;

    /**
     * Find rooms by status
     */
    findByStatus(status: string): Promise<IRoom[]>;
}
