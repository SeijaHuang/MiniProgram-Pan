/**
 * Request Logger Middleware
 * Logs incoming HTTP requests
 *
 * ARCHITECTURE: Middleware Layer
 * - Logs request method, path, IP, timestamp
 * - Measures request duration
 * - Can integrate with logging libraries (Winston, Pino)
 *
 * FUTURE: Integrate with proper logging library
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Request logger middleware
 * Logs all incoming requests
 *
 * Example usage:
 * ```typescript
 * import { requestLogger } from './middlewares/logging/request-logger.middleware';
 *
 * app.use(requestLogger);
 * ```
 */
export function requestLogger(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const start = Date.now();

    // Log request
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);

    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`
        );
    });

    next();
}

/**
 * Performance logger middleware
 * Logs slow requests
 */
export function performanceLogger(threshold: number = 1000) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const start = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - start;
            if (duration > threshold) {
                console.warn(
                    `[SLOW REQUEST] ${req.method} ${req.path} took ${duration}ms`
                );
            }
        });

        next();
    };
}
