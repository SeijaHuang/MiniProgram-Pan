// Load environment variables FIRST before any other imports
import { loadEnv, validateEnv } from './utils/env-loader';
loadEnv();
validateEnv();

// Now import modules that depend on environment variables
import http from 'http';
import app from './app';
import { initWebSocket } from './ws';
import { APP_CONFIG } from './constants/config';

const server = http.createServer(app);

initWebSocket(server);

server.listen(APP_CONFIG.PORT, () => {
    console.log(`Server listening on port ${APP_CONFIG.PORT}`);
    console.log(`Environment: ${APP_CONFIG.NODE_ENV}`);
});

// Graceful shutdown handler
function handleShutdown(signal: string): void {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
