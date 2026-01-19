/**
 * Environment variable loader
 * Load and validate environment variables
 */

import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Load environment variables from .env file
 */
export function loadEnv(): void {
    const envPath = resolve(__dirname, '../../.env');

    const result = config({ path: envPath });

    if (result.error) {
        console.warn('Warning: .env file not found, using default values');
    } else {
        console.log('Environment variables loaded successfully');
    }
}

/**
 * Validate required environment variables
 */
export function validateEnv(): void {
    const requiredVars: string[] = [];

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}`
        );
    }
}
