import './bootstrap'; // Must be first — loads .env before other modules read process.env

import http from 'http';

import app from './app';
import { APP_CONFIG } from './constants/config';
import { logger } from './utils/logger';
import { initWebSocket } from './ws';

let server: http.Server;

function bootstrap(): void {
    server = http.createServer(app);
    initWebSocket(server);

    server.listen(APP_CONFIG.PORT, () => {
        logger.log('Server', `Server listening on port ${APP_CONFIG.PORT}`);
        logger.log('Server', `Environment: ${APP_CONFIG.NODE_ENV}`);
    });
}

bootstrap();

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
