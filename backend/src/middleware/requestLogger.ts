/**
 * HTTP Request Logger Middleware
 * Logs each HTTP request with method, path, status, and duration
 *
 * ARCHITECTURE: Middleware layer
 * - Listens for the response 'finish' event to capture status + duration
 * - Does NOT contain business logic
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const startMs = Date.now();
    res.on('finish', () => {
        logger.info('http.request', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs: Date.now() - startMs,
        });
    });
    next();
}
