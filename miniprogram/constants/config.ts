/**
 * Application Configuration
 * Centralized configuration for the mini program
 */

/**
 * Backend Server Configuration
 * IMPORTANT: Update these values based on your environment
 */
export const BACKEND_CONFIG = {
    // 开发环境：本地服务器
    // 生产环境：云端服务器
    HTTP_BASE_URL: 'http://localhost:8080',
    WS_BASE_URL: 'ws://localhost:8080',
    WS_PATH: '/ws',
} as const;

/**
 * Tencent Cloud Configuration
 */
export const TENCENT_CONFIG = {
    STSSERVICE_URL: 'https://sts.tencentcloudapi.com',
} as const;

/**
 * Room Configuration
 */
export const ROOM_CONFIG = {
    CODE_LENGTH: 6,
    MAX_PARTICIPANTS: 2,
} as const;

/**
 * WebSocket Configuration
 */
export const WS_CONFIG = {
    HEARTBEAT_INTERVAL: 30000, // 30秒心跳
    RECONNECT_DELAY: 3000, // 3秒后重连
    MAX_RECONNECT_ATTEMPTS: 5, // 最多重连5次
} as const;
