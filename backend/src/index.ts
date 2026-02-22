// Now import modules that depend on environment variables
import http from 'http';

import { loadEnv, validateEnv } from './utils/env-loader';
import { logger } from './utils/logger';
let server: http.Server;

async function bootstrap() {
    loadEnv();
    validateEnv();

    const { default: app } = await import('./app');
    const { initWebSocket } = await import('./ws');
    const { APP_CONFIG } = await import('./constants/config');

    server = http.createServer(app);
    initWebSocket(server);

    server.listen(APP_CONFIG.PORT, () => {
        logger.log('Server', `Server listening on port ${APP_CONFIG.PORT}`);
        logger.log('Server', `Environment: ${APP_CONFIG.NODE_ENV}`);
    });
}

bootstrap().catch(e => {
    logger.error('Server', 'Bootstrap failed:', e);
    process.exit(1);
});

// Graceful shutdown handler
function handleShutdown(signal: string): void {
    logger.log('Server', `\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
        logger.log('Server', 'Server closed');
        process.exit(0);
    });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
