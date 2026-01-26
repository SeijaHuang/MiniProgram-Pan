/**
 * Drum Message Validation Schemas
 * Zod schemas for runtime validation of drum game WebSocket messages
 *
 * ARCHITECTURE: Validation Layer
 * - Runtime validation using Zod
 * - Type inference from schemas
 * - Clear error messages
 */

import { z } from 'zod';
import { EPlayerRole } from '../../types/websocket/base';

/**
 * DRUM_TAP Data Schema
 */
export const DrumTapDataSchema = z.object({
    roomId: z.string().min(1, 'roomId is required'),
    role: z.nativeEnum(EPlayerRole),
    delta: z.number().int().positive('delta must be a positive integer'),
    clientTimeMs: z.number(),
});
