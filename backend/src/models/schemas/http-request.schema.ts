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
import { UserSchema } from './ws-message.schema';

/**
 * Create Room Request Schema
 * POST /v1/rooms
 */
export const CreateRoomRequestSchema = z.object({
    creator: UserSchema,
});

/**
 * Type inference from schemas
 */
export type TCreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
