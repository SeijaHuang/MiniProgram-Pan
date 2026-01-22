/**
 * Send Message Request DTO
 * Data Transfer Object for sending chat messages
 *
 * ARCHITECTURE: Request DTO
 * - Defines the shape of chat message request data
 * - Used in WebSocket CHAT_SEND messages
 */

import type { IMessageContent } from '../../entities/message';

export interface ISendMessageDto {
    content: IMessageContent;
}
