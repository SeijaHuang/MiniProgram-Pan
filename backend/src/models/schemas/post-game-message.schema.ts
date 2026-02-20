/**
 * Post-Game Message Validation Schema
 * Zod schema for runtime validation of post-game action messages
 */

import { z } from 'zod';

export const PostGameActionSchema = z.object({
    roomId: z.string().min(1, 'roomId is required'),
    action: z.enum(['execute_punishment', 'beg_for_mercy']),
    remainingCount: z.number().int().min(0),
});
