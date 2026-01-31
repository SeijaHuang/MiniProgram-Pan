/**
 * Room API Types
 * 房间 HTTP API 类型定义
 * 用于 waiting-room 页面的房间创建功能
 */

import type { IUser } from '@/models/user';
import type { IRoom } from '@/models/room';

/**
 * HTTP Error Codes
 * HTTP 错误码
 */
export enum EHttpErrorCode {
    RoomCreateFailed = 'ROOM_CREATE_FAILED',
    InvalidRequest = 'INVALID_REQUEST',
    InternalError = 'INTERNAL_ERROR',
}

/**
 * Base HTTP Response
 * HTTP 响应基础结构
 */
export interface IBaseResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: EHttpErrorCode;
        message?: string;
    };
}

/**
 * Create Room Request
 * 创建房间请求
 */
export interface ICreateRoomRequest {
    creator: IUser;
}

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
export type ICreateRoomResponse = IBaseResponse<ICreateRoomResponseData>;
