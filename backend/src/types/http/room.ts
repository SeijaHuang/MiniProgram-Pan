/**
 * HTTP Room Types
 * Request and response types for room-related HTTP endpoints
 */

import type { IRoom } from '../../models/entities/room';

/**
 * Create Room Response Data
 * POST /v1/rooms
 */
export interface ICreateRoomResponseData {
    room: IRoom;
}
