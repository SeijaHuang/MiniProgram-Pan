/**
 * Room Service
 * Handles room creation via HTTP API
 */

import type { IRoom } from '@/models/room';
import type { ICreateRoomResponse } from '@/types/room-api';
import { BACKEND_CONFIG } from '@/constants/config';

class RoomService {
    /**
     * Create a new chat room
     * @param creator - The user creating the room
     * @returns Promise with room data
     */
    async createRoom(creator: {
        userId: string;
        nickname: string;
    }): Promise<IRoom> {
        return new Promise<IRoom>((resolve, reject) => {
            wx.request({
                url: `${BACKEND_CONFIG.HTTP_BASE_URL}/room/create`,
                method: 'POST',
                header: {
                    'content-type': 'application/json',
                },
                data: {
                    creator,
                },
                success: res => {
                    if (res.statusCode === 201) {
                        const response = res.data as ICreateRoomResponse;
                        if (response.success && response.data) {
                            resolve(response.data.room);
                        } else {
                            reject(
                                new Error(
                                    response.error?.message ??
                                        'Failed to create room'
                                )
                            );
                        }
                    } else {
                        const response = res.data as ICreateRoomResponse;
                        reject(
                            new Error(
                                response.error?.message ??
                                    'Failed to create room'
                            )
                        );
                    }
                },
                fail: error => {
                    reject(new Error(`Network error: ${error.errMsg}`));
                },
            });
        });
    }
}

// Export singleton instance
export const roomService = new RoomService();
