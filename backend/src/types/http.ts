/**
 * HTTP Transport Layer Types
 * DTOs for HTTP communication
 */

import type { IUser } from '../models/entities/user';
import type { IRoom } from '../models/entities/room';
import type { IBaseResponse } from '../models/dto/response/base.response.dto';

/**
 * HTTP Error Codes
 */
export enum EHttpErrorCode {
    RoomCreateFailed = 'ROOM_CREATE_FAILED',
    InvalidRequest = 'INVALID_REQUEST',
    InternalError = 'INTERNAL_ERROR',
}

/**
 * Re-export base response for HTTP usage
 */
export type { IBaseResponse }

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
