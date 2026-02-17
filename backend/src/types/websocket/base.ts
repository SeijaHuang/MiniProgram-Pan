/**
 * WebSocket Base Types
 * Core WebSocket message structure and enums
 */

/**
 * WebSocket Message Types
 */
export enum EWSMessageType {
    // Client → Server
    JoinRoom = 'JOIN_ROOM',
    ChatSend = 'CHAT_SEND',
    AsrTextPush = 'ASR_TEXT_PUSH',
    EmojiSend = 'EMOJI_SEND',

    // Server → Client
    JoinAck = 'JOIN_ACK',
    ChatReceive = 'CHAT_RECEIVE',
    AsrText = 'ASR_TEXT',
    EmojiReceive = 'EMOJI_RECEIVE',
    Error = 'ERROR',

    // Drum Game (Bidirectional)
    DrumReady = 'DRUM_READY',
    DrumStart = 'DRUM_START',
    DrumTap = 'DRUM_TAP',
    DrumFinish = 'DRUM_FINISH',
    DrumResult = 'DRUM_RESULT',

    // Speech Turn Management
    SpeechTurnEnd = 'SPEECH_TURN_END', // Client → Server
    SpeechTurnSwitch = 'SPEECH_TURN_SWITCH', // Server → Client
    ChatComplete = 'CHAT_COMPLETE', // Server → Client

    // Verdict Delivery
    VerdictResult = 'VERDICT_RESULT', // Server → Client
    VerdictFailed = 'VERDICT_FAILED', // Server → Client
    VerdictRetry = 'VERDICT_RETRY', // Client → Server
}

/**
 * Player Role in drum game
 * - Organizer: The player who created the room
 * - Joiner: The player who joined the room
 */
export enum EPlayerRole {
    Organizer = 'Organizer',
    Joiner = 'Joiner',
}

/**
 * Base WebSocket Message
 * Generic container for all WebSocket messages
 */
export interface IWSMessage<T = unknown> {
    type: EWSMessageType;
    data: T;
    timestamp: number;
}
