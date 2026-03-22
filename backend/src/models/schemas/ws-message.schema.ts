/**
 * WebSocket Message Validation Schemas
 * Zod schemas for runtime validation of WebSocket messages
 *
 * ARCHITECTURE: Validation Layer
 * - Runtime validation using Zod
 * - Type inference from schemas
 * - Clear error messages
 */

import { z } from 'zod';
import { EMessageType } from '../entities/message';

/**
 * JOIN_ROOM Data Schema
 */
export const JoinRoomDataSchema = z.object({
    roomCode: z.string().min(1, 'roomCode is required'),
    nickname: z.string().min(1, 'nickname is required'),
});

/**
 * Message Content Schema
 */
export const MessageContentSchema = z.object({
    type: z.nativeEnum(EMessageType),
    text: z.string().min(1, 'text is required'),
});

/**
 * CHAT_SEND Data Schema
 */
export const ChatSendDataSchema = z.object({
    content: MessageContentSchema,
});
