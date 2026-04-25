/**
 * Application Configuration
 * Single source of truth for all runtime config.
 *
 * Environments:
 *   develop + DevTools    → http://localhost:8080,          DEBUG on
 *   develop + real device → http://<LAN_IP>:8080,          DEBUG on
 *   trial                 → https://panleme.fun,            DEBUG on
 *   release               → https://panleme.fun,            DEBUG off
 *
 * No manual switching needed — auto-detected at runtime.
 */

type EnvVersion = WechatMiniprogram.AccountInfo['miniProgram']['envVersion'];

interface IEnvConfig {
    apiBaseUrl: string;
    wsUrl: string;
    debug: boolean;
}

/** LAN IP for real device testing in develop mode */
const LAN_IP: string = '192.168.31.205';

const ENV_CONFIGS = {
    devtools: {
        apiBaseUrl: 'http://localhost:8080',
        wsUrl: 'ws://localhost:8080/ws',
        debug: true,
    },
    realDevice: {
        apiBaseUrl: `http://${LAN_IP}:8080`,
        wsUrl: `ws://${LAN_IP}:8080/ws`,
        debug: true,
    },
    trial: {
        apiBaseUrl: 'https://panleme.fun',
        wsUrl: 'wss://panleme.fun/ws',
        debug: true,
    },
    release: {
        apiBaseUrl: 'https://panleme.fun',
        wsUrl: 'wss://panleme.fun/ws',
        debug: false,
    },
} as const;

function isRealDevice(): boolean {
    try {
        return wx.getSystemInfoSync().platform !== 'devtools';
    } catch {
        return false;
    }
}

function resolveEnv(): EnvVersion {
    try {
        return wx.getAccountInfoSync().miniProgram.envVersion;
    } catch {
        return 'release';
    }
}

function resolveConfig(envVersion: EnvVersion): IEnvConfig {
    if (envVersion === 'develop') {
        return isRealDevice() ? ENV_CONFIGS.realDevice : ENV_CONFIGS.devtools;
    }
    return ENV_CONFIGS[envVersion];
}

export const ENV: EnvVersion = resolveEnv();
export const config: IEnvConfig = resolveConfig(ENV);
export const API_BASE_URL: string = config.apiBaseUrl;
export const WS_URL: string = config.wsUrl;
export const DEBUG: boolean = config.debug;

/**
 * WebSocket Configuration
 */
export const WS_CONFIG = {
    HEARTBEAT_INTERVAL: 30000, // 30秒心跳
    RECONNECT_DELAY: 3000, // 3秒后重连
    MAX_RECONNECT_ATTEMPTS: 5, // 最多重连5次
} as const;
