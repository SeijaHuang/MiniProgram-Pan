/**
 * WebSocket Manager
 * Manages WebSocket connection lifecycle
 *
 * Responsibilities:
 * - Connection management (connect, disconnect, reconnect)
 * - Heartbeat mechanism
 * - Message sending and receiving
 * - Connection state tracking
 */

import { WS_CONFIG } from '../constants/config';
import { WS_URL } from '../constants/env';
import { logger } from '../utils/logger';

type ConnectionState =
    | 'DISCONNECTED'
    | 'CONNECTING'
    | 'CONNECTED'
    | 'RECONNECTING';

type MessageHandler = (data: string) => void;
type ConnectionHandler = () => void;
type ErrorHandler = (error: WechatMiniprogram.GeneralCallbackResult) => void;

interface IWebSocketManagerCallbacks {
    onMessage?: MessageHandler;
    onConnect?: ConnectionHandler;
    onDisconnect?: ConnectionHandler;
    onError?: ErrorHandler;
}

class WebSocketManager {
    private socketTask: WechatMiniprogram.SocketTask | null = null;
    private state: ConnectionState = 'DISCONNECTED';
    private heartbeatTimer: number | null = null;
    private reconnectTimer: number | null = null;
    private reconnectAttempts: number = 0;
    private callbacks: IWebSocketManagerCallbacks = {};

    /**
     * Connect to WebSocket server
     */
    connect(callbacks: IWebSocketManagerCallbacks = {}): void {
        if (this.state === 'CONNECTED' || this.state === 'CONNECTING') {
            logger.log('WS', 'Already connected or connecting');
            return;
        }

        this.callbacks = callbacks;
        this.state = 'CONNECTING';

        const url = WS_URL;
        logger.log('WS', `Connecting to ${url}`);

        this.socketTask = wx.connectSocket({
            url,
            success: () => {
                logger.log('WS', 'Connection initiated');
            },
            fail: error => {
                logger.error('WS', 'Connection failed:', error);
                this.handleConnectionError();
            },
        });

        this.setupSocketHandlers();
    }

    /**
     * Setup WebSocket event handlers
     */
    private setupSocketHandlers(): void {
        if (!this.socketTask) {
            return;
        }

        this.socketTask.onOpen(() => {
            logger.log('WS', 'Connected');
            this.state = 'CONNECTED';
            this.reconnectAttempts = 0;
            this.startHeartbeat();

            if (this.callbacks.onConnect) {
                this.callbacks.onConnect();
            }
        });

        this.socketTask.onMessage(event => {
            if (this.callbacks.onMessage) {
                this.callbacks.onMessage(event.data as string);
            }
        });

        this.socketTask.onClose(() => {
            logger.log('WS', 'Connection closed');
            this.handleDisconnect();
        });

        this.socketTask.onError(error => {
            logger.error('WS', 'Error:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
            this.handleConnectionError();
        });
    }

    /**
     * Send message to server
     */
    send(message: object): void {
        if (!this.socketTask || this.state !== 'CONNECTED') {
            logger.error('WS', 'Cannot send message: not connected');
            return;
        }

        this.socketTask.send({
            data: JSON.stringify(message),
            success: () => {
                logger.log('WS', 'Message sent');
            },
            fail: error => {
                logger.error('WS', 'Failed to send message:', error);
            },
        });
    }

    /**
     * Start heartbeat mechanism
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();

        this.heartbeatTimer = setInterval(() => {
            if (this.state === 'CONNECTED' && this.socketTask) {
                logger.log('WS', 'Heartbeat');
                // Could send a ping message here if needed
            }
        }, WS_CONFIG.HEARTBEAT_INTERVAL) as unknown as number;
    }

    /**
     * Stop heartbeat
     */
    private stopHeartbeat(): void {
        if (this.heartbeatTimer !== null) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Handle disconnection
     */
    private handleDisconnect(): void {
        this.state = 'DISCONNECTED';
        this.stopHeartbeat();

        if (this.callbacks.onDisconnect) {
            this.callbacks.onDisconnect();
        }

        // Attempt reconnection
        this.attemptReconnect();
    }

    /**
     * Handle connection error
     */
    private handleConnectionError(): void {
        this.state = 'DISCONNECTED';
        this.stopHeartbeat();
        this.attemptReconnect();
    }

    /**
     * Attempt to reconnect
     */
    private attemptReconnect(): void {
        if (this.reconnectAttempts >= WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
            logger.error('WS', 'Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        this.state = 'RECONNECTING';

        logger.log(
            'WS',
            `Reconnecting... (${this.reconnectAttempts}/${WS_CONFIG.MAX_RECONNECT_ATTEMPTS})`
        );

        this.reconnectTimer = setTimeout(() => {
            this.connect(this.callbacks);
        }, WS_CONFIG.RECONNECT_DELAY) as unknown as number;
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect(): void {
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.stopHeartbeat();

        if (this.socketTask) {
            this.socketTask.close({
                success: () => {
                    logger.log('WS', 'Disconnected');
                },
            });
            this.socketTask = null;
        }

        this.state = 'DISCONNECTED';
        this.reconnectAttempts = 0;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.state === 'CONNECTED';
    }

    /**
     * Update callbacks
     */
    updateCallbacks(callbacks: IWebSocketManagerCallbacks): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }
}

// Export singleton instance
export const wsManager = new WebSocketManager();
