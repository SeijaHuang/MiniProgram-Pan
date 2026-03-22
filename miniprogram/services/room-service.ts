/**
 * Room Service
 * Handles room creation via HTTP API
 */

import { API_BASE_URL } from '../constants/env';
import type { IRoom } from '../models/room';
import type { ICreateRoomResponse } from '../types/room-api';

class RoomService {
    /**
     * Create a new chat room
     * @returns Promise with room data
     */
    async createRoom(): Promise<IRoom> {
        return new Promise<IRoom>((resolve, reject) => {
            wx.request({
                url: `${API_BASE_URL}/v1/rooms`,
                method: 'POST',
                header: {
                    'content-type': 'application/json',
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
