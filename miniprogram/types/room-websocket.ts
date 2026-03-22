/**
 * Room WebSocket Types
 * 房间 WebSocket 消息类型定义
 * 用于 waiting-room 页面的房间加入功能
 */

import type { IRoom } from '../models/room';

import type { IWSMessage, EWSMessageType } from './websocket-common';

// ==================== Client → Server ====================

/**
 * JOIN_ROOM: Request to join a room using a roomCode
 * 加入房间请求（客户端 → 服务器）
 */
export interface IJoinRoomMessage extends IWSMessage<IJoinRoomData> {
    type: EWSMessageType.JoinRoom;
}

export interface IJoinRoomData {
    roomCode: string;
    nickname: string;
}

// ==================== Server → Client ====================

/**
 * JOIN_ACK: Confirmation of room join
 * 加入房间确认（服务器 → 客户端）
 */
export interface IJoinAckMessage extends IWSMessage<IJoinAckData> {
    type: EWSMessageType.JoinAck;
}

export interface IJoinAckData {
    selfUserId: string;
    room: IRoom;
}
