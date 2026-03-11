/**
 * Application configuration constants
 * Centralized configuration management for chat room system
 */

export const APP_CONFIG = {
    PORT: Number(process.env.PORT) || 8080,
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
} as const;

export const WS_CONFIG = {
    PATH: process.env.WS_PATH || '/ws',
} as const;

export const ROOM_CONFIG = {
    MAX_PARTICIPANTS: 2,
    ROOM_CODE_LENGTH: 6,
} as const;

export const WAITING_ROOM_CONFIG = {
    /** Countdown duration before starting waiting room (ms) */
    COUNTDOWN_MS: 3000,
} as const;

export const DRUM_CONFIG = {
    /** Countdown duration before game starts (ms) */
    COUNTDOWN_MS: 3000,
    /** Game duration (ms) */
    GAME_DURATION_MS: 10000,
    /** Max taps to win instantly */
    MAX_TAPS: 30,
} as const;

export const VERDICT_CONFIG = {
    /** LLM call timeout (ms) */
    LLM_TIMEOUT_MS: 30000,
    /** Maximum retry attempts */
    MAX_RETRIES: 3,
} as const;

export const AI_CONFIG = {
    /** AI API key */
    API_KEY: process.env.AI_API_KEY || '',
    /** AI model to use */
    MODEL: process.env.AI_MODEL || '',
    /** Optional base URL for AI-compatible APIs */
    BASE_URL: process.env.AI_BASE_URL || '',
} as const;

export const TENCENT_CONFIG = {
    SECRET_ID: process.env.TENCENT_SECRET_ID,
    SECRET_KEY: process.env.TENCENT_SECRET_KEY,
    REGION: process.env.TENCENT_REGION,
} as const;
