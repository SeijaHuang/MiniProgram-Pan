module.exports = {
    apps: [{
      name: 'backend',
      script: './dist/index.js',
  
      env_trial: {
        NODE_ENV: 'trial',
        PORT: 8080,
        WS_PATH: '/ws',
        WS_HEARTBEAT_INTERVAL: 30000,
        WS_CLIENT_TIMEOUT: 60000,
        WS_MAX_RECONNECT: 5,
        GAME_ROOM_TIMEOUT: 300000,
        GAME_MOVE_TIMEOUT: 30000,
        OPENAI_MODEL: 'gpt-4o-mini',
        LLM_WORKER_POLL_INTERVAL_MS: 500,
        LLM_WORKER_LOCK_TIMEOUT_MS: 60000,
        LLM_MAX_RETRIES: 3,
        TENCENT_REGION: 'ap-shanghai',
      },
  
      env_release: {
        NODE_ENV: 'release',
        PORT: 8080,
        WS_PATH: '/ws',
        WS_HEARTBEAT_INTERVAL: 30000,
        WS_CLIENT_TIMEOUT: 60000,
        WS_MAX_RECONNECT: 5,
        GAME_ROOM_TIMEOUT: 300000,
        GAME_MOVE_TIMEOUT: 30000,
        OPENAI_MODEL: 'gpt-4o-mini',
        LLM_WORKER_POLL_INTERVAL_MS: 500,
        LLM_WORKER_LOCK_TIMEOUT_MS: 60000,
        LLM_MAX_RETRIES: 3,
        TENCENT_REGION: 'ap-shanghai',
      }
    }]
  }