/**
 * Create Room Request DTO
 * Data Transfer Object for room creation requests
 *
 * ARCHITECTURE: Request DTO
 * - Defines the shape of client request data
 * - Used for type safety in controllers
 * - Zod schema validates at runtime
 */

import type { IUser } from '../../entities/user';

export interface ICreateRoomDto {
    creator: IUser;
}
