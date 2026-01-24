/**
 * Base Repository Interface
 * Generic CRUD interface for all repositories
 *
 * ARCHITECTURE: Data Access Layer
 * - Defines standard CRUD operations
 * - All repositories should implement this interface
 * - Provides database abstraction
 *
 * FUTURE: Implementations will use MongoDB/PostgreSQL/etc.
 */

/**
 * Base repository interface for CRUD operations
 * @template T - Entity type
 */
export interface IBaseRepository<T> {
    /**
     * Create a new entity
     */
    create(data: Partial<T>): Promise<T>;

    /**
     * Find entity by ID
     */
    findById(id: string): Promise<T | null>;

    /**
     * Find all entities matching filter
     */
    findAll(filter?: Record<string, unknown>): Promise<T[]>;

    /**
     * Update entity by ID
     */
    update(id: string, data: Partial<T>): Promise<T>;

    /**
     * Delete entity by ID
     */
    delete(id: string): Promise<boolean>;

    /**
     * Count entities matching filter
     */
    count(filter?: Record<string, unknown>): Promise<number>;
}
