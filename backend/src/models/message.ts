/**
 * Message Domain Model
 * Represents a chat message within a room
 * 
 * CRITICAL: Every message belongs to exactly one room
 * CRITICAL: Sender must be a participant of that room
 * CRITICAL: Message type must match its content
 */

import type { IUser } from './user';

export enum EMessageType {
    Text = 'TEXT',
}

export type MessageContent = {
    type: EMessageType.Text;
    text: string;
};

export interface IMessage {
    messageId: string;
    roomId: string;
    sender: IUser;
    type: EMessageType;
    content: MessageContent;
    createdAt: number;
}
