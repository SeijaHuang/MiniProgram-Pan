/**
 * Common utility types
 */

/**
 * Make specific properties of T optional
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties of T required
 */
export type Required<T, K extends keyof T> = Omit<T, K> &
    globalThis.Required<Pick<T, K>>;

/**
 * Result type for operations that can succeed or fail
 */
export type Result<T, E = Error> =
    | { success: true; data: T }
    | { success: false; error: E };

/**
 * Async result type
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
