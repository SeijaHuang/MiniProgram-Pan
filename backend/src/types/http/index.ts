/**
 * HTTP Types Index
 * Centralized exports for all HTTP-related types
 *
 * ARCHITECTURE: Type Organization
 * - base.ts: Common HTTP types (response format, error codes)
 * - room.ts: Room resource types
 * - [future] user.ts: User resource types
 * - [future] message.ts: Message resource types
 */

// Base types
export * from './base';

// Resource-specific types
export * from './room';
