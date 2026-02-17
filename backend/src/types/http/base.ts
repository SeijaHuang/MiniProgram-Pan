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
    InvalidRequest = 'INVALID_REQUEST',
    LlmCallFailed = 'LLM_CALL_FAILED',
    STSGetFailed = 'STS_GET_FAILED',
}

/**
 * Re-export base response for HTTP usage
 */
export type { IBaseResponse };
