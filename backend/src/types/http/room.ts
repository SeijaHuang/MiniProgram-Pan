/**
 * HTTP Room Types
 * Request and response types for room-related HTTP endpoints
 */

import type { IUser } from '../../models/entities/user';
import type { IRoom } from '../../models/entities/room';

/**
 * Create Room Request
 * POST /v1/rooms
 */
export interface ICreateRoomRequest {
    creator: IUser;
}

/**
 * Create Room Response Data
 * POST /v1/rooms
 */
export interface ICreateRoomResponseData {
    room: IRoom;
}
