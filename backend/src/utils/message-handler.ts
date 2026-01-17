/**
 * WebSocket message handler
 * Base class for handling specific message types
 */

import type { WSClient } from '../utils/ws-client';
import type { IBaseMessage } from '../types/ws-messages';

export abstract class MessageHandler<T = unknown> {
    /**
     * Handle incoming message
     * @param client - WebSocket client that sent the message
     * @param message - Parsed message data
     */
    abstract handle(
        client: WSClient,
        message: IBaseMessage<T>
    ): Promise<void> | void;

    /**
     * Send error response to client
     */
    protected sendError(
        client: WSClient,
        code: string,
        message: string,
        details?: unknown
    ): void {
        client.send('error', {
            code,
            message,
            details,
        });
    }
}
