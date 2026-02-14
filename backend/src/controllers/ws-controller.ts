/**
 * WebSocket Controller
 * Handles WebSocket message routing and response formatting
 *
 * ARCHITECTURE: Controller layer
 * - Routes messages to appropriate handlers
 * - Handles connection lifecycle
 * - Formats WebSocket messages
 * - Does NOT contain business logic
 */

import type { RawData } from 'ws';
import { connectionManager } from '../services/websocket/connection-manager';
import {
    handleJoinRoom,
    type TJoinRoomHandlerResult,
} from '../services/handlers/join-room-handler';
import {
    handleChatSend,
    type TChatSendHandlerResult,
} from '../services/handlers/chat-send-handler';
import {
    handleDrumTap,
    type TDrumTapHandlerResult,
} from '../services/handlers/drum-tap-handler';
import {
    handleEmojiText,
    type TEmojiTextHandlerResult,
} from '../services/handlers/emoji-text-handler';
import {
    handleASRTextPush,
    type TASRTextPushHandlerResult,
    type IASRTextPushResult,
} from '../services/handlers/asr-text-handler';
import { handleSpeechTurnEnd } from '../services/handlers/speech-turn-end-handler';
import { handleVerdictRetry } from '../services/handlers/verdict-retry-handler';
import { drumGameManager } from '../services/websocket/drum-game-manager';
import { roomManager } from '../services/websocket/room-manager';
import { verdictOrchestratorService } from '../services/core/verdict-orchestrator.service';
import type {
    IWSMessage,
    IJoinRoomMessage,
    IChatSendMessage,
    IDrumTapMessage,
    IASRTextPushMessage,
    IEmojiSendMessage,
    ISpeechTurnEndMessage,
    IVerdictRetryMessage,
    IChatCompleteData,
} from '../types/websocket';
import { EWSMessageType, EWSErrorCode, EGamePhase } from '../types/websocket';
import { ERoomStatus } from '../models/entities/room';
import { DRUM_CONFIG, WAITING_ROOM_CONFIG } from '../constants/config';

export class WebSocketController {
    /**
     * Handle incoming WebSocket message
     * Routes message to appropriate handler based on type
     */
    static handleMessage(connectionId: string, data: RawData): void {
        try {
            const messageText = WebSocketController.rawDataToText(data);
            const message = JSON.parse(messageText) as IWSMessage;

            // Route message to appropriate handler
            switch (message.type) {
                case EWSMessageType.JoinRoom:
                    WebSocketController.handleJoinRoomMessage(
                        connectionId,
                        message as IJoinRoomMessage
                    );
                    break;

                case EWSMessageType.ChatSend:
                    WebSocketController.handleChatSendMessage(
                        connectionId,
                        message as IChatSendMessage
                    );
                    break;

                case EWSMessageType.DrumTap:
                    WebSocketController.handleDrumTapMessage(
                        connectionId,
                        message as IDrumTapMessage
                    );
                    break;

                case EWSMessageType.AsrTextPush:
                    WebSocketController.handleASRTextPushMessage(
                        connectionId,
                        message as IASRTextPushMessage
                    );
                    break;

                case EWSMessageType.EmojiSend:
                    WebSocketController.handleEmojiSendMessage(
                        connectionId,
                        message as IEmojiSendMessage
                    );
                    break;

                case EWSMessageType.SpeechTurnEnd:
                    WebSocketController.handleSpeechTurnEndMessage(
                        connectionId,
                        message as ISpeechTurnEndMessage
                    );
                    break;

                case EWSMessageType.VerdictRetry:
                    WebSocketController.handleVerdictRetryMessage(
                        connectionId,
                        message as IVerdictRetryMessage
                    );
                    break;

                default:
                    WebSocketController.sendError(
                        connectionId,
                        EWSErrorCode.InvalidPayload,
                        `Unknown message type: ${message.type}`
                    );
            }
        } catch (error) {
            console.error(
                '[WebSocketController] Message handling error:',
                error
            );
            WebSocketController.sendError(
                connectionId,
                EWSErrorCode.InternalError,
                error instanceof Error ? error.message : 'Unknown error'
            );
        }
    }

    /**
     * Handle JOIN_ROOM message
     * Calls business logic handler and formats response
     */
    private static handleJoinRoomMessage(
        connectionId: string,
        message: IJoinRoomMessage
    ): void {
        const result: TJoinRoomHandlerResult = handleJoinRoom(
            connectionManager,
            connectionId,
            message
        );

        if (!result.success) {
            // Send error to client
            WebSocketController.sendError(
                connectionId,
                result.code,
                result.message
            );
            return;
        }

        // Broadcast JOIN_ACK to ALL participants
        connectionManager.broadcastToRoom(result.room.roomId, {
            type: EWSMessageType.JoinAck,
            data: {
                room: result.room,
            },
            timestamp: Date.now(),
        });

        // If room is ready (2 players), start drum game
        if (result.room.status === ERoomStatus.Ready) {
            setTimeout(() => {
                WebSocketController.startDrumGame(result.room.roomId);
            }, WAITING_ROOM_CONFIG.COUNTDOWN_MS);
        }
    }

    /**
     * Handle CHAT_SEND message
     * Calls business logic handler and formats response
     */
    private static handleChatSendMessage(
        connectionId: string,
        message: IChatSendMessage
    ): void {
        const result: TChatSendHandlerResult = handleChatSend(
            connectionManager,
            connectionId,
            message
        );

        if (!result.success) {
            // Send error to client
            WebSocketController.sendError(
                connectionId,
                result.code,
                result.message
            );
            return;
        }

        // Broadcast CHAT_RECEIVE to ALL participants
        connectionManager.broadcastToRoom(result.roomId, {
            type: EWSMessageType.ChatReceive,
            data: {
                message: result.message,
            },
            timestamp: Date.now(),
        });
    }

    /**
     * Handle DRUM_TAP message
     * Calls business logic handler and forwards to opponent
     */
    private static handleDrumTapMessage(
        connectionId: string,
        message: IDrumTapMessage
    ): void {
        const result: TDrumTapHandlerResult = handleDrumTap(message);

        if (!result.success) {
            WebSocketController.sendError(
                connectionId,
                result.code,
                result.message
            );
            return;
        }

        // Forward tap to opponent (exclude sender)
        connectionManager.broadcastToRoomExcept(
            result.roomId,
            {
                type: EWSMessageType.DrumTap,
                data: {
                    roomId: result.roomId,
                    role: result.role,
                    delta: result.delta,
                    clientTimeMs: Date.now(),
                },
                timestamp: Date.now(),
            },
            connectionId
        );
    }

    /**
     * Handle ASR_TEXT_PUSH message
     * Calls business logic handler and broadcasts to other participants
     */
    private static handleASRTextPushMessage(
        connectionId: string,
        message: IASRTextPushMessage
    ): void {
        // Create broadcast callback for throttled partials
        const onThrottledBroadcast = (result: IASRTextPushResult): void => {
            WebSocketController.broadcastASRText(connectionId, result);
        };

        const result: TASRTextPushHandlerResult = handleASRTextPush(
            connectionManager,
            connectionId,
            message,
            onThrottledBroadcast
        );

        if (!result.success) {
            WebSocketController.sendError(
                connectionId,
                result.code,
                result.message
            );
            return;
        }

        // Broadcast immediately if shouldBroadcast is true (final messages)
        if (result.shouldBroadcast) {
            WebSocketController.broadcastASRText(connectionId, result);
        }
    }

    /**
     * Handle EMOJI_SEND message
     * Calls business logic handler and broadcasts to other participants
     */
    private static handleEmojiSendMessage(
        connectionId: string,
        message: IEmojiSendMessage
    ): void {
        const result: TEmojiTextHandlerResult = handleEmojiText(
            connectionManager,
            connectionId,
            message
        );

        if (!result.success) {
            WebSocketController.sendError(
                connectionId,
                result.code,
                result.message
            );
            return;
        }

        // Broadcast EMOJI_RECEIVE to ALL participants
        connectionManager.broadcastToRoomExcept(
            result.roomId,
            {
                type: EWSMessageType.EmojiReceive,
                data: {
                    roomId: result.roomId,
                    emoji: result.message.emoji,
                },
                timestamp: Date.now(),
            },
            connectionId
        );
    }

    /**
     * Broadcast ASR_TEXT to room participants (excluding sender)
     */
    private static broadcastASRText(
        senderConnectionId: string,
        result: IASRTextPushResult
    ): void {
        connectionManager.broadcastToRoomExcept(
            result.roomId,
            {
                type: EWSMessageType.AsrText,
                data: {
                    roomId: result.roomId,
                    speakerId: result.speakerId,
                    seq: result.seq,
                    text: result.text,
                    isFinal: result.isFinal,
                },
                timestamp: Date.now(),
            },
            senderConnectionId
        );
    }

    /**
     * Start drum game flow
     * Called when room is ready (2 players joined)
     */
    private static startDrumGame(roomId: string): void {
        const room = roomManager.getRoomById(roomId);
        if (!room) {
            console.error(`[WebSocketController] Room ${roomId} not found`);
            return;
        }

        // Initialize game state
        const game = drumGameManager.initGame(room);

        // Broadcast DRUM_READY with player info
        // 使用角色默认名称，当用户没有设置昵称或使用默认昵称时
        const organizerNickname = game.organizer.nickname;
        const joinerNickname = game.joiner.nickname;
        const organizerName =
            organizerNickname && organizerNickname !== '匿名用户'
                ? organizerNickname
                : '小冤家';
        const joinerName =
            joinerNickname && joinerNickname !== '匿名用户'
                ? joinerNickname
                : '家冤小';

        connectionManager.broadcastToRoom(roomId, {
            type: EWSMessageType.DrumReady,
            data: {
                roomId,
                serverTimeMs: Date.now(),
                hostRole: game.hostRole,
                organizerName,
                joinerName,
            },
            timestamp: Date.now(),
        });

        // Set countdown phase
        drumGameManager.setPhase(roomId, EGamePhase.Countdown);

        // Calculate timing
        const startAtMs = Date.now() + DRUM_CONFIG.COUNTDOWN_MS;
        const endAtMs = startAtMs + DRUM_CONFIG.GAME_DURATION_MS;
        drumGameManager.setTiming(roomId, startAtMs, endAtMs);

        // Broadcast DRUM_START with timing
        connectionManager.broadcastToRoom(roomId, {
            type: EWSMessageType.DrumStart,
            data: {
                roomId,
                startAtMs,
            },
            timestamp: Date.now(),
        });

        // Schedule game start (running phase)
        setTimeout(() => {
            drumGameManager.setPhase(roomId, EGamePhase.Running);
            console.log(`[WebSocketController] Game ${roomId} is now RUNNING`);
        }, DRUM_CONFIG.COUNTDOWN_MS);

        // Schedule game finish
        setTimeout(() => {
            WebSocketController.finishDrumGame(roomId, endAtMs);
        }, DRUM_CONFIG.COUNTDOWN_MS + DRUM_CONFIG.GAME_DURATION_MS);

        console.log(
            `[WebSocketController] Started drum game ${roomId} (start: ${startAtMs}, end: ${endAtMs})`
        );
    }

    /**
     * Finish drum game and broadcast result
     */
    private static finishDrumGame(roomId: string, endAtMs: number): void {
        // Broadcast DRUM_FINISH
        connectionManager.broadcastToRoom(roomId, {
            type: EWSMessageType.DrumFinish,
            data: {
                roomId,
                endAtMs,
            },
            timestamp: Date.now(),
        });

        // Calculate result
        const result = drumGameManager.calculateResult(roomId);
        if (!result) {
            console.error(
                `[WebSocketController] Game ${roomId} not found for result`
            );
            return;
        }

        // Broadcast DRUM_RESULT
        connectionManager.broadcastToRoom(roomId, {
            type: EWSMessageType.DrumResult,
            data: {
                roomId,
                organizerScore: result.organizerScore,
                joinerScore: result.joinerScore,
                winnerRole: result.winnerRole,
            },
            timestamp: Date.now(),
        });

        // Cleanup game state
        drumGameManager.cleanupGame(roomId);

        console.log(
            `[WebSocketController] Game ${roomId} finished: ${result.winnerRole} wins (${result.organizerScore} vs ${result.joinerScore})`
        );
    }

    /**
     * Handle SPEECH_TURN_END message
     * Called when a player finishes their speech
     */
    private static handleSpeechTurnEndMessage(
        connectionId: string,
        message: ISpeechTurnEndMessage
    ): void {
        // Call handler
        const result = handleSpeechTurnEnd(message);

        if (!result.success) {
            WebSocketController.sendError(
                connectionId,
                result.code,
                result.message
            );
            return;
        }

        console.log(
            `[WebSocketController] Speech turn end for user ${result.userId} in room ${result.roomId}`
        );

        // If both players finished, broadcast CHAT_COMPLETE and trigger verdict
        if (result.bothFinished) {
            console.log(
                `[WebSocketController] Chat complete, triggering verdict generation for room ${result.roomId}`
            );

            // Broadcast CHAT_COMPLETE
            const chatCompleteData: IChatCompleteData = {
                roomId: result.roomId,
            };

            connectionManager.broadcastToRoom(result.roomId, {
                type: EWSMessageType.ChatComplete,
                data: chatCompleteData,
                timestamp: Date.now(),
            });

            // Trigger verdict generation (async, don't block)
            verdictOrchestratorService
                .generateVerdict(result.roomId, connectionManager)
                .catch(error => {
                    console.error(
                        `[WebSocketController] Verdict generation error: ${error}`
                    );
                });
        }
    }

    /**
     * Handle VERDICT_RETRY message
     * Called when user requests retry after verdict failure
     */
    private static handleVerdictRetryMessage(
        connectionId: string,
        message: IVerdictRetryMessage
    ): void {
        // Call handler
        const result = handleVerdictRetry(message);

        if (!result.success) {
            WebSocketController.sendError(
                connectionId,
                result.code,
                result.message
            );
            return;
        }

        console.log(
            `[WebSocketController] Verdict retry requested by user ${result.userId} in room ${result.roomId}`
        );

        // If can retry, trigger verdict generation again
        if (result.canRetry) {
            verdictOrchestratorService
                .generateVerdict(result.roomId, connectionManager)
                .catch(error => {
                    console.error(
                        `[WebSocketController] Verdict retry error: ${error}`
                    );
                });
        } else {
            console.log(
                `[WebSocketController] Max retries reached for room ${result.roomId}`
            );
        }
    }

    /**
     * Handle connection disconnect
     * Cleans up connection and updates room state
     */
    static handleDisconnect(connectionId: string): void {
        console.log(
            `[WebSocketController] Client disconnected: ${connectionId}`
        );
        connectionManager.handleDisconnect(connectionId);
    }

    /**
     * Send error message to connection
     * Helper method for formatting error responses
     */
    private static sendError(
        connectionId: string,
        code: EWSErrorCode,
        message: string
    ): void {
        connectionManager.sendToConnection(connectionId, {
            type: EWSMessageType.Error,
            data: {
                code,
                message,
            },
            timestamp: Date.now(),
        });
    }

    /**
     * Convert RawData to text
     * Helper method for parsing WebSocket data
     */
    private static rawDataToText(data: RawData): string {
        if (Buffer.isBuffer(data)) {
            return data.toString('utf-8');
        }
        if (Array.isArray(data)) {
            return Buffer.concat(data).toString('utf-8');
        }
        // ArrayBuffer case
        return Buffer.from(data).toString('utf-8');
    }
}
