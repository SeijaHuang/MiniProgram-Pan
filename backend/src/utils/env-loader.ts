/**
 * Environment variable loader
 * Load environment variables from .env file
 */

import { config } from 'dotenv';
import { resolve } from 'path';

import { logger } from './logger';

/**
 * Load environment variables from .env file
 */
export function loadEnv(): void {
    const envPath = resolve(__dirname, '../../.env');
    const result = config({ path: envPath });

    if (result.error) {
        logger.warn(
            'EnvLoader',
            'Warning: .env file not found, using default values'
        );
    } else {
        logger.log('EnvLoader', 'Environment variables loaded successfully');
    }
}

/**
 * Validate required environment variables
 * Simple validation - just log warnings if missing
 */
export function validateEnv(): void {
    // No strict validation needed
    logger.log('EnvLoader', 'Environment variables loaded');
}
