/**
 * Create Room Request DTO
 * Data Transfer Object for room creation requests
 *
 * ARCHITECTURE: Request DTO
 * - Defines the shape of client request data
 * - Used for validation and type safety
 */

import type { IUser } from '../../entities/user';

export interface ICreateRoomDto {
    creator?: IUser;
}
