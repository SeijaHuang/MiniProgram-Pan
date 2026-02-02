/**
 * ASR_TEXT_PUSH Validation Schema
 * Zod schema for runtime validation of ASR text push messages
 */

import { z } from 'zod';

/**
 * ASR_TEXT_PUSH Data Schema
 * Validates the data payload of ASR_TEXT_PUSH messages
 */
export const ASRTextPushDataSchema = z.object({
    /** Room identifier */
    roomId: z.string().min(1, 'roomId is required'),
    /** Speaker's user ID */
    speakerId: z.string().min(1, 'speakerId is required'),
    /** Sequence number for deduplication (non-negative integer) */
    seq: z.number().int().min(0, 'seq must be a non-negative integer'),
    /** Recognized text (can be empty for partial results) */
    text: z.string(),
    /** Whether this is the final result */
    isFinal: z.boolean(),
});

/**
 * Type inference from schema
 */
export type TASRTextPushData = z.infer<typeof ASRTextPushDataSchema>;
