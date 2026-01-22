/**
 * Base Response DTO
 * Simple response structure for API responses
 *
 * YAGNI: Keep it simple - only what we need now
 */

/**
 * Success response
 */
export interface ISuccessResponse<T> {
    success: true;
    data: T;
}

/**
 * Error response
 */
export interface IErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
    };
}

/**
 * Base response type
 */
export type IBaseResponse<T> = ISuccessResponse<T> | IErrorResponse;
