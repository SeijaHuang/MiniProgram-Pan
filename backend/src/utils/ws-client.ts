/**
 * WebSocket client wrapper
 * Wraps WebSocket connection with metadata
 */

import type { WebSocket } from 'ws';

export interface IWSClient {
    id: string;
    ws: WebSocket;
    playerId: string | null;
    roomId: string | null;
    lastHeartbeat: Date;
    connectedAt: Date;
}

export class WSClient implements IWSClient {
    public id: string;
    public ws: WebSocket;
    public playerId: string | null = null;
    public roomId: string | null = null;
    public lastHeartbeat: Date;
    public connectedAt: Date;

    constructor(id: string, ws: WebSocket) {
        this.id = id;
        this.ws = ws;
        this.connectedAt = new Date();
        this.lastHeartbeat = new Date();
    }

    /**
     * Update heartbeat timestamp
     */
    updateHeartbeat(): void {
        this.lastHeartbeat = new Date();
    }

    /**
     * Check if client connection is alive
     */
    isAlive(timeoutMs: number): boolean {
        const now = Date.now();
        const lastHeartbeatTime = this.lastHeartbeat.getTime();
        return now - lastHeartbeatTime < timeoutMs;
    }

    /**
     * Send message to client
     */
    send<T>(type: string, data: T): void {
        if (this.ws.readyState === this.ws.OPEN) {
            const message = {
                type,
                data,
                timestamp: Date.now(),
            };
            this.ws.send(JSON.stringify(message));
        }
    }

    /**
     * Close connection
     */
    close(code?: number, reason?: string): void {
        this.ws.close(code, reason);
    }
}
