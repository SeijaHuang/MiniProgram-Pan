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

import { BACKEND_CONFIG, WS_CONFIG } from '../constants/config';

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
            console.log('[WebSocketManager] Already connected or connecting');
            return;
        }

        this.callbacks = callbacks;
        this.state = 'CONNECTING';

        const url = `${BACKEND_CONFIG.WS_BASE_URL}${BACKEND_CONFIG.WS_PATH}`;
        console.log(`[WebSocketManager] Connecting to ${url}`);

        this.socketTask = wx.connectSocket({
            url,
            success: () => {
                console.log('[WebSocketManager] Connection initiated');
            },
            fail: error => {
                console.error('[WebSocketManager] Connection failed:', error);
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
            console.log('[WebSocketManager] Connected');
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
            console.log('[WebSocketManager] Connection closed');
            this.handleDisconnect();
        });

        this.socketTask.onError(error => {
            console.error('[WebSocketManager] Error:', error);
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
            console.error(
                '[WebSocketManager] Cannot send message: not connected'
            );
            return;
        }

        this.socketTask.send({
            data: JSON.stringify(message),
            success: () => {
                console.log('[WebSocketManager] Message sent');
            },
            fail: error => {
                console.error(
                    '[WebSocketManager] Failed to send message:',
                    error
                );
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
                console.log('[WebSocketManager] Heartbeat');
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
            console.error('[WebSocketManager] Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        this.state = 'RECONNECTING';

        console.log(
            `[WebSocketManager] Reconnecting... (${this.reconnectAttempts}/${WS_CONFIG.MAX_RECONNECT_ATTEMPTS})`
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
                    console.log('[WebSocketManager] Disconnected');
                },
            });
            this.socketTask = null;
        }

        this.state = 'DISCONNECTED';
        this.reconnectAttempts = 0;
    }

    /**
     * Get current connection state
     */
    getState(): ConnectionState {
        return this.state;
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
