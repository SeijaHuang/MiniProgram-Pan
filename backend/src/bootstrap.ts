/**
 * Bootstrap module — must be imported first in index.ts.
 * Loads .env before any other module reads process.env.
 */
import { resolve } from 'path';

import { config } from 'dotenv';

import { logger } from './utils/logger';

const result = config({ path: resolve(__dirname, '../.env') });

if (result.error) {
    logger.warn(
        'Bootstrap',
        'Warning: .env file not found, using default values'
    );
} else {
    logger.log('Bootstrap', 'Environment variables loaded successfully');
}
