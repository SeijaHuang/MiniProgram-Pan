/**
 * HTTP Base Types
 * Common HTTP response structure and error codes
 */

import type { IBaseResponse } from '../../models/dto/response/base.response.dto';

/**
 * HTTP Error Codes
 */
export enum EHttpErrorCode {
    RoomCreateFailed = 'ROOM_CREATE_FAILED',
    RoomNotFound = 'ROOM_NOT_FOUND',
    InvalidRequest = 'INVALID_REQUEST',
    InternalError = 'INTERNAL_ERROR',
    LlmCallFailed = 'LLM_CALL_FAILED',
}

/**
 * Re-export base response for HTTP usage
 */
export type { IBaseResponse };
