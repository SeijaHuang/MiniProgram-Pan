/**
 * Error Handler Middleware
 * Centralized error handling for Express application
 *
 * ARCHITECTURE: Middleware Layer
 * - Catches all errors from routes/controllers
 * - Formats error responses consistently
 * - Logs errors for monitoring
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Application Error class
 */
export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public code?: string
    ) {
        super(message);
        this.name = 'AppError';
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error handler middleware
 * Must be registered last in middleware chain
 *
 * Example usage in app.ts:
 * ```typescript
 * import { errorHandler } from './middlewares/error/error-handler.middleware';
 *
 * app.use(errorHandler);
 * ```
 */
export function errorHandler(
    err: Error | AppError,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    // Determine status code
    const statusCode = err instanceof AppError ? err.statusCode : 500;

    // Determine error code
    const code = err instanceof AppError ? err.code : 'INTERNAL_SERVER_ERROR';

    // Log error
    console.error('[ErrorHandler]', {
        method: req.method,
        path: req.path,
        error: err.message,
        stack: err.stack,
    });

    // Send response
    res.status(statusCode).json({
        success: false,
        error: {
            code,
            message: err.message,
            ...(process.env.NODE_ENV === 'development' && {
                stack: err.stack,
            }),
        },
    });
}

/**
 * Not found handler
 * Handles 404 errors
 */
export function notFoundHandler(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const error = new AppError(404, `Route ${req.path} not found`, 'NOT_FOUND');
    next(error);
}
