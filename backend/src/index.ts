import http from 'http';
import app from './app';
import { initWebSocket } from './ws';
import { loadEnv, validateEnv } from './utils/env-loader';
import { APP_CONFIG } from './constants/config';

// Load environment variables
loadEnv();
validateEnv();

const server = http.createServer(app);

initWebSocket(server);

server.listen(APP_CONFIG.PORT, () => {
    console.log(`Server listening on port ${APP_CONFIG.PORT}`);
    console.log(`Environment: ${APP_CONFIG.NODE_ENV}`);
});
