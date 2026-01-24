/**
 * WebSocket Error Types
 * Error codes and error message structure
 */

import type { IWSMessage } from './base';
import { EWSMessageType } from './base';

/**
 * WebSocket Error Codes
 */
export enum EWSErrorCode {
    InvalidPayload = 'INVALID_PAYLOAD',
    RoomNotFound = 'ROOM_NOT_FOUND',
    RoomFull = 'ROOM_FULL',
    RoomClosed = 'ROOM_CLOSED',
    NotParticipant = 'NOT_PARTICIPANT',
    RoomNotReady = 'ROOM_NOT_READY',
    AlreadyJoined = 'ALREADY_JOINED',
    InternalError = 'INTERNAL_ERROR',
}

/**
 * ERROR: Protocol or domain failure
 * CRITICAL: Must not change room state
 * CRITICAL: Client must treat error as authoritative
 */
export interface IWSErrorMessage extends IWSMessage<IWSErrorData> {
    type: EWSMessageType.Error;
}

export interface IWSErrorData {
    code: EWSErrorCode;
    message?: string;
}
