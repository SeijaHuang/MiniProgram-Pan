/**
 * HTTP Transport Layer Types
 * DTOs for HTTP communication
 */

import type { IUser } from '../models/user';
import type { IRoom } from '../models/room';

/**
 * HTTP Error Codes
 */
export enum EHttpErrorCode {
    RoomCreateFailed = 'ROOM_CREATE_FAILED',
    InvalidRequest = 'INVALID_REQUEST',
    InternalError = 'INTERNAL_ERROR',
}

/**
 * Base HTTP Response
 */
export interface IBaseResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: EHttpErrorCode;
        message?: string;
    };
}

/**
 * Create Room Request
 */
export interface ICreateRoomRequest {
    creator: IUser;
}

/**
 * Create Room Response Data
 */
export interface ICreateRoomResponseData {
    room: IRoom;
}
