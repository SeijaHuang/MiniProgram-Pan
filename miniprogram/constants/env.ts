/**
 * Environment Configuration
 * Auto-detects environment via wx.getAccountInfoSync() — no manual switching needed.
 *
 * develop  → 'dev'     : localhost, DEBUG on
 * trial    → 'trial'   : panleme.fun, DEBUG on
 * release  → 'release' : panleme.fun, DEBUG off
 */

type EnvVersion = WechatMiniprogram.AccountInfo['miniProgram']['envVersion'];
type Env = EnvVersion | 'develop';

interface IEnvConfig {
    apiBaseUrl: string;
    wsUrl: string;
    debug: boolean;
}

const ENV_CONFIGS: Record<Env, IEnvConfig> = {
    develop: {
        apiBaseUrl: 'http://localhost:8080',
        wsUrl: 'ws://localhost:8080/ws',
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
};

function resolveEnv(): Env {
    try {
        const { envVersion } = wx.getAccountInfoSync().miniProgram;
        return envVersion === 'develop' ? 'develop' : envVersion;
    } catch {
        return 'release';
    }
}

export const ENV: Env = resolveEnv();
export const config: IEnvConfig = ENV_CONFIGS[ENV];
export const API_BASE_URL: string = config.apiBaseUrl;
export const WS_URL: string = config.wsUrl;
export const DEBUG: boolean = config.debug;
