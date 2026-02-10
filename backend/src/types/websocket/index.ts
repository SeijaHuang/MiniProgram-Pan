/**
 * WebSocket Types Index
 * Centralized exports for all WebSocket-related types
 *
 * ARCHITECTURE: Type Organization
 * - base.ts: Core message structure
 * - join-room.ts: Room join flow types
 * - chat.ts: Chat messaging types
 * - error.ts: Error handling types
 * - drum.ts: Drum game types
 * - asr.ts: ASR (speech recognition) types
 */

// Base types
export * from './base';

// Feature-specific types
export * from './join-room';
export * from './chat';
export * from './error';
export * from './drum';
export * from './asr';
export * from './emoji';

// Union types
import type { IJoinRoomMessage, IJoinAckMessage } from './join-room';
import type { IChatSendMessage, IChatReceiveMessage } from './chat';
import type { IWSErrorMessage } from './error';
import type { TDrumMessage } from './drum';
import type { TASRMessage } from './asr';
import type { IEmojiMessage } from './emoji';
8;

/**
 * Union type of all WebSocket messages
 */
export type WSMessage =
    | IJoinRoomMessage
    | IChatSendMessage
    | IJoinAckMessage
    | IChatReceiveMessage
    | IWSErrorMessage
    | TDrumMessage
    | TASRMessage
    | IEmojiMessage;
