import http from 'http';
import { loadEnv, validateEnv } from './utils/env-loader';

// Load environment variables
async function bootstrap() {
    loadEnv();
    validateEnv();

    // 动态 import：确保 env 已经就位
    const { default: app } = await import('./app');
    const { initWebSocket } = await import('./ws');
    const { APP_CONFIG } = await import('./constants/config');

    const server = http.createServer(app);
    initWebSocket(server);

    server.listen(APP_CONFIG.PORT, () => {
        console.log(`Server listening on port ${APP_CONFIG.PORT}`);
        console.log(`Environment: ${APP_CONFIG.NODE_ENV}`);
    });
}

bootstrap().catch(e => {
    console.error('Bootstrap failed:', e);
    process.exit(1);
});
