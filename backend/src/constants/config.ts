/**
 * Application configuration constants
 * Centralized configuration management
 */

export const APP_CONFIG = {
    PORT: Number(process.env.PORT) || 8080,
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
} as const;

export const WS_CONFIG = {
    PATH: process.env.WS_PATH || '/ws',
    HEARTBEAT_INTERVAL: Number(process.env.WS_HEARTBEAT_INTERVAL) || 30000,
    CLIENT_TIMEOUT: Number(process.env.WS_CLIENT_TIMEOUT) || 60000,
    MAX_RECONNECT_ATTEMPTS: Number(process.env.WS_MAX_RECONNECT) || 5,
} as const;

export const GAME_CONFIG = {
    MAX_PLAYERS_PER_ROOM: 2,
    ROOM_TIMEOUT: Number(process.env.GAME_ROOM_TIMEOUT) || 300000, // 5 minutes
    MOVE_TIMEOUT: Number(process.env.GAME_MOVE_TIMEOUT) || 30000, // 30 seconds
} as const;
