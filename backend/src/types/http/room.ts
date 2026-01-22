/**
 * HTTP Room Types
 * Request and response types for room-related HTTP endpoints
 */

import type { IUser } from '../../models/entities/user';
import type { IRoom } from '../../models/entities/room';

/**
 * Create Room Request
 * POST /room/create
 */
export interface ICreateRoomRequest {
    creator: IUser;
}

/**
 * Create Room Response Data
 * POST /room/create
 */
export interface ICreateRoomResponseData {
    room: IRoom;
}
