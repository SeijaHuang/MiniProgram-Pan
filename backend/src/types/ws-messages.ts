/**
 * WebSocket message types and interfaces
 * Defines the protocol for client-server communication
 */

import type { IGameRoom, IGameMove } from '../models/game';
import type { IPlayer } from '../models/player';

/**
 * All possible message types
 */
export enum MessageType {
    // Connection messages
    WELCOME = 'welcome',
    HEARTBEAT = 'heartbeat',
    HEARTBEAT_ACK = 'heartbeat_ack',
    ERROR = 'error',

    // Room management
    ROOM_CREATE = 'room:create',
    ROOM_CREATED = 'room:created',
    ROOM_JOIN = 'room:join',
    ROOM_JOINED = 'room:joined',
    ROOM_LEAVE = 'room:leave',
    ROOM_LEFT = 'room:left',
    ROOM_LIST = 'room:list',
    ROOM_LIST_RESPONSE = 'room:list_response',

    // Player management
    PLAYER_READY = 'player:ready',
    PLAYER_JOINED = 'player:joined',
    PLAYER_LEFT = 'player:left',
    PLAYER_DISCONNECTED = 'player:disconnected',
    PLAYER_RECONNECTED = 'player:reconnected',

    // Game flow
    GAME_START = 'game:start',
    GAME_MOVE = 'game:move',
    GAME_UPDATE = 'game:update',
    GAME_END = 'game:end',
    GAME_PAUSE = 'game:pause',
    GAME_RESUME = 'game:resume',
}

/**
 * Base message structure
 */
export interface IBaseMessage<T = unknown> {
    type: MessageType;
    data: T;
    timestamp: number;
}

/**
 * Error message
 */
export interface IErrorMessage extends IBaseMessage<IErrorData> {
    type: MessageType.ERROR;
}

export interface IErrorData {
    code: string;
    message: string;
    details?: unknown;
}

/**
 * Welcome message (sent on connection)
 */
export interface IWelcomeMessage extends IBaseMessage<IWelcomeData> {
    type: MessageType.WELCOME;
}

export interface IWelcomeData {
    clientId: string;
    serverTime: number;
}

/**
 * Heartbeat messages
 */
export interface IHeartbeatMessage extends IBaseMessage<IHeartbeatData> {
    type: MessageType.HEARTBEAT;
}

export interface IHeartbeatData {
    timestamp: number;
}

/**
 * Room create message
 */
export interface IRoomCreateMessage extends IBaseMessage<IRoomCreateData> {
    type: MessageType.ROOM_CREATE;
}

export interface IRoomCreateData {
    playerName: string;
    playerAvatar?: string;
}

/**
 * Room created response
 */
export interface IRoomCreatedMessage extends IBaseMessage<IRoomCreatedData> {
    type: MessageType.ROOM_CREATED;
}

export interface IRoomCreatedData {
    room: IGameRoom;
    player: IPlayer;
}

/**
 * Room join message
 */
export interface IRoomJoinMessage extends IBaseMessage<IRoomJoinData> {
    type: MessageType.ROOM_JOIN;
}

export interface IRoomJoinData {
    roomId: string;
    playerName: string;
    playerAvatar?: string;
}

/**
 * Room joined response
 */
export interface IRoomJoinedMessage extends IBaseMessage<IRoomJoinedData> {
    type: MessageType.ROOM_JOINED;
}

export interface IRoomJoinedData {
    room: IGameRoom;
    player: IPlayer;
}

/**
 * Player joined notification
 */
export interface IPlayerJoinedMessage extends IBaseMessage<IPlayerJoinedData> {
    type: MessageType.PLAYER_JOINED;
}

export interface IPlayerJoinedData {
    player: IPlayer;
    room: IGameRoom;
}

/**
 * Player ready message
 */
export interface IPlayerReadyMessage extends IBaseMessage<IPlayerReadyData> {
    type: MessageType.PLAYER_READY;
}

export interface IPlayerReadyData {
    playerId: string;
}

/**
 * Game start notification
 */
export interface IGameStartMessage extends IBaseMessage<IGameStartData> {
    type: MessageType.GAME_START;
}

export interface IGameStartData {
    room: IGameRoom;
    startingPlayer: string;
}

/**
 * Game move message
 */
export interface IGameMoveMessage extends IBaseMessage<IGameMoveData> {
    type: MessageType.GAME_MOVE;
}

export interface IGameMoveData {
    x: number;
    y: number;
}

/**
 * Game update notification
 */
export interface IGameUpdateMessage extends IBaseMessage<IGameUpdateData> {
    type: MessageType.GAME_UPDATE;
}

export interface IGameUpdateData {
    room: IGameRoom;
    lastMove: IGameMove;
}

/**
 * Game end notification
 */
export interface IGameEndMessage extends IBaseMessage<IGameEndData> {
    type: MessageType.GAME_END;
}

export interface IGameEndData {
    room: IGameRoom;
    winner: string | null;
    reason: 'completed' | 'timeout' | 'abandoned';
}

/**
 * Union type of all message types
 */
export type WSMessage =
    | IWelcomeMessage
    | IHeartbeatMessage
    | IErrorMessage
    | IRoomCreateMessage
    | IRoomCreatedMessage
    | IRoomJoinMessage
    | IRoomJoinedMessage
    | IPlayerJoinedMessage
    | IPlayerReadyMessage
    | IGameStartMessage
    | IGameMoveMessage
    | IGameUpdateMessage
    | IGameEndMessage;
