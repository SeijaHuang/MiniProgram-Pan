/**
 * Message Model
 * Represents a chat message
 */

import type { IUser } from './user';

export enum EMessageType {
    Text = 'TEXT',
    Voice = 'VOICE',
}

export interface ITextContent {
    type: EMessageType.Text;
    text: string;
}

export interface IVoiceContent {
    type: EMessageType.Voice;
    voiceUrl: string;
    duration: number;
    transcription?: string;
}

export type MessageContent = ITextContent | IVoiceContent;

export interface IMessage {
    messageId: string;
    roomId: string;
    sender: IUser;
    type: EMessageType;
    content: MessageContent;
    createdAt: number;
}
