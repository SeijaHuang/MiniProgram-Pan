/**
 * HTTP Request Validation Schemas
 * Zod schemas for runtime validation of HTTP requests
 *
 * ARCHITECTURE: Validation Layer
 * - Runtime validation using Zod
 * - Type inference from schemas
 * - Clear error messages
 */

import { z } from 'zod';

/**
 * Create Room Request Schema
 * POST /v1/rooms
 * No user identity required — creator joins via JOIN_ROOM WebSocket message
 */
export const CreateRoomRequestSchema = z.object({});

/**
 * Type inference from schemas
 */
export type TCreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
