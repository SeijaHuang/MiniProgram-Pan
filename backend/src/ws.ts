/**
 * WebSocket Server
 * Configures WebSocket server and connection handling
 *
 * ARCHITECTURE: Application setup
 * - Initializes WebSocket server
 * - Registers connection event handlers
 * - Delegates message handling to controller
 * - Does NOT contain business logic
 */

import { Server, type WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { randomBytes } from 'crypto';
import { connectionManager } from './services/websocket/connection-manager';
import { WebSocketController } from './controllers/ws-controller';
import { WS_CONFIG } from './constants/config';
import { logger } from './utils/logger';

export function initWebSocket(server: HttpServer): void {
    const wss = new Server({
        server,
        path: WS_CONFIG.PATH,
    });

    logger.log('WS', `Server initialized on path: ${WS_CONFIG.PATH}`);

    wss.on('connection', (ws: WebSocket) => {
        const connectionId = generateConnectionId();
        logger.log('WS', `Client connected: ${connectionId}`);

        // Register connection
        connectionManager.registerConnection(connectionId, ws);
        logger.info('ws.connected', { connectionId });

        logger.log(
            'WS',
            `Client connected: ${connectionId} (Total: ${connectionManager.getAllConnections().length})`
        );

        // Handle incoming messages - delegate to controller
        ws.on('message', data => {
            WebSocketController.handleMessage(connectionId, data);
        });

        // Handle connection close - delegate to controller
        ws.on('close', () => {
            WebSocketController.handleDisconnect(connectionId);
        });

        // Handle errors
        ws.on('error', error => {
            logger.error('WS', `Error for connection ${connectionId}:`, error);
        });
    });
}

/**
 * Generate unique connection ID
 */
function generateConnectionId(): string {
    return `conn_${randomBytes(8).toString('hex')}`;
}
