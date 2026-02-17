/**
 * Room API Types
 * 房间 HTTP API 类型定义
 * 用于 waiting-room 页面的房间创建功能
 */

import type { IRoom } from '../models/room';

/**
 * Create Room Response Data
 * 创建房间响应数据
 */
export interface ICreateRoomResponseData {
    room: IRoom;
}

/**
 * Create Room Response
 * 创建房间响应
 */
export interface ICreateRoomResponse {
    success: boolean;
    data?: ICreateRoomResponseData;
    error?: {
        code: string;
        message?: string;
    };
}
