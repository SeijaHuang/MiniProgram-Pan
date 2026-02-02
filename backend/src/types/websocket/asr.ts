/**
 * ASR (Automatic Speech Recognition) WebSocket Types
 * Types for real-time speech recognition text synchronization
 */

import type { IWSMessage } from './base';
import { EWSMessageType } from './base';

/**
 * ASR_TEXT_PUSH Data (Client → Server)
 * Sent by the speaker to push ASR text to the server
 */
export interface IASRTextPushData {
    /** Room identifier */
    roomId: string;
    /** Speaker's user ID (must match connection's userId) */
    speakerId: string;
    /** Sequence number for deduplication */
    seq: number;
    /** The recognized text */
    text: string;
    /** Whether this is the final result for the utterance */
    isFinal: boolean;
}

/**
 * ASR_TEXT Data (Server → Client)
 * Broadcast to other participants in the room
 */
export interface IASRTextData {
    /** Room identifier */
    roomId: string;
    /** Speaker's user ID */
    speakerId: string;
    /** Sequence number */
    seq: number;
    /** The recognized text */
    text: string;
    /** Whether this is the final result for the utterance */
    isFinal: boolean;
}

/**
 * ASR_TEXT_PUSH Message (Client → Server)
 */
export interface IASRTextPushMessage extends IWSMessage<IASRTextPushData> {
    type: EWSMessageType.AsrTextPush;
}

/**
 * ASR_TEXT Message (Server → Client)
 */
export interface IASRTextMessage extends IWSMessage<IASRTextData> {
    type: EWSMessageType.AsrText;
}

/**
 * Union type of all ASR messages
 */
export type TASRMessage = IASRTextPushMessage | IASRTextMessage;
