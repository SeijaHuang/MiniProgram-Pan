/**
 * Join Room Request DTO
 * Data Transfer Object for room join requests
 *
 * ARCHITECTURE: Request DTO
 * - Defines the shape of join room request data
 * - Used in WebSocket JOIN_ROOM messages
 */

import type { IUser } from '../../entities/user';

export interface IJoinRoomDto {
    roomCode: string;
    user: IUser;
}
