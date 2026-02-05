/* eslint-disable */
/**
 * Validation Middleware
 * Generic validation middleware for request validation using Zod
 *
 * ARCHITECTURE: Middleware Layer
 * - Validates request body, params, query against Zod schemas
 * - Returns standardized error responses
 * - Type-safe validation
 *
 * For WebSocket message validation, see models/schemas/ws-message.schema.ts
 */

import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';

/**
 * Validation result
 */
export interface IValidationResult {
    success: boolean;
    errors?: Record<string, string[]>;
}

/**
 * Generic validation middleware factory
 *
 * Example usage:
 * ```typescript
 * import { validate } from './middlewares/validation/validation.middleware';
 * import { CreateRoomRequestSchema } from './models/schemas/http-request.schema';
 *
 * router.post('/create', validate(CreateRoomRequestSchema), RoomController.createRoom);
 * ```
 */
export function validate(schema: z.ZodTypeAny) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.issues;
            const errorMessage = errors[0]?.message ?? 'Validation failed';
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: errorMessage,
                    details: errors,
                },
            });
            return;
        }
        req.body = result.data;
        next();
    };
}

/**
 * Validate request body
 */
export function validateBody(schema: z.ZodTypeAny) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.issues;
            const errorMessage = errors[0]?.message ?? 'Invalid request body';
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: errorMessage,
                    details: errors,
                },
            });
            return;
        }
        req.body = result.data;
        next();
    };
}

/**
 * Validate request params
 */
export function validateParams(schema: z.ZodTypeAny) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            const errors = result.error.issues;
            const errorMessage = errors[0]?.message ?? 'Invalid request params';
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: errorMessage,
                    details: errors,
                },
            });
            return;
        }
        Object.assign(req.params, result.data);
        next();
    };
}

/**
 * Validate request query
 */
export function validateQuery(schema: z.ZodTypeAny) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            const errors = result.error.issues;
            const errorMessage = errors[0]?.message ?? 'Invalid request query';
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: errorMessage,
                    details: errors,
                },
            });
            return;
        }
        Object.assign(req.query, result.data);
        next();
    };
}
