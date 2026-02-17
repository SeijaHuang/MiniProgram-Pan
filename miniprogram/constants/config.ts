/**
 * Application Configuration
 * Centralized configuration for the mini program
 */

/**
 * 判断是否为真机环境
 * 真机环境无法访问 localhost，需要使用局域网 IP
 */
function isRealDevice(): boolean {
    try {
        const systemInfo = wx.getSystemInfoSync();
        // 微信开发者工具的 platform 为 'devtools'
        return systemInfo.platform !== 'devtools';
    } catch {
        return false;
    }
}

/**
 * Backend Server Configuration
 * IMPORTANT: Update these values based on your environment
 */
const ENV_CONFIG = {
    // 开发者工具环境：使用 localhost
    devtools: {
        HTTP_BASE_URL: 'http://localhost:8080',
        WS_BASE_URL: 'ws://localhost:8080',
    },
    // 真机测试环境：使用局域网 IP
    realDevice: {
        HTTP_BASE_URL: 'http://192.168.31.204:8080',
        WS_BASE_URL: 'ws://192.168.31.204:8080',
    },
} as const;

const currentEnv = isRealDevice() ? ENV_CONFIG.realDevice : ENV_CONFIG.devtools;

export const BACKEND_CONFIG = {
    HTTP_BASE_URL: currentEnv.HTTP_BASE_URL,
    WS_BASE_URL: currentEnv.WS_BASE_URL,
    WS_PATH: '/ws',
} as const;

/**
 * WebSocket Configuration
 */
export const WS_CONFIG = {
    HEARTBEAT_INTERVAL: 30000, // 30秒心跳
    RECONNECT_DELAY: 3000, // 3秒后重连
    MAX_RECONNECT_ATTEMPTS: 5, // 最多重连5次
} as const;
