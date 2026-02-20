/**
 * Verdict Message Validation Schemas
 * Zod schemas for validating verdict-related WebSocket messages
 */

import { z } from 'zod';

/**
 * SPEECH_TURN_END data validation
 */
export const SpeechTurnEndDataSchema = z.object({
    roomId: z.string().min(1, 'roomId is required'),
    userId: z.string().min(1, 'userId is required'),
});

/**
 * VERDICT_RETRY data validation
 */
export const VerdictRetryDataSchema = z.object({
    roomId: z.string().min(1, 'roomId is required'),
    userId: z.string().min(1, 'userId is required'),
});

/**
 * LEAVE_ROOM data validation
 */
export const LeaveRoomDataSchema = z.object({
    roomId: z.string().min(1, 'roomId is required'),
});
