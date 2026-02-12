/**
 * Emoji Message Validation Schemas
 * Zod schemas for runtime validation of emoji WebSocket messages
 *
 * ARCHITECTURE: Validation Layer
 * - Runtime validation using Zod
 * - Type inference from schemas
 * - Clear error messages
 */

import { z } from 'zod';

export const EmojiMessageSchema = z.object({
    roomId: z.string().min(1, 'roomId is required'),
    senderId: z.string().min(1, 'senderId is required'),
    emoji: z.string().min(1, 'emoji is required'),
});
