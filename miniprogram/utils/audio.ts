/**
 * Audio Utilities
 * Sound effects management for drum room
 */

/** Audio context pool for drum sounds */
const AUDIO_POOL_SIZE: number = 5;
let audioPool: WechatMiniprogram.InnerAudioContext[] = [];
let audioIndex: number = 0;
let audioEnabled: boolean = true;

/** Drum sound file path */
const DRUM_SOUND_PATH: string = '/assets/audio/drum.mp3';

/**
 * Initialize audio pool
 * Creates multiple audio contexts for overlapping sounds
 */
export function initAudioPool(): void {
    destroyAudioPool();

    for (let i: number = 0; i < AUDIO_POOL_SIZE; i++) {
        const ctx: WechatMiniprogram.InnerAudioContext =
            wx.createInnerAudioContext();
        ctx.src = DRUM_SOUND_PATH;
        ctx.volume = 0.8;
        ctx.onError(
            (err: WechatMiniprogram.InnerAudioContextOnErrorListenerResult) => {
                console.warn(`[Audio] Pool ${i} error:`, err.errMsg);
                // Disable audio if file not found
                if (err.errCode === 10001 || err.errCode === -1) {
                    audioEnabled = false;
                    console.warn(
                        '[Audio] Drum sound not found, audio disabled'
                    );
                }
            }
        );
        audioPool.push(ctx);
    }

    console.log('[Audio] Pool initialized with', AUDIO_POOL_SIZE, 'contexts');
}

/**
 * Play drum sound
 * Uses round-robin from audio pool to allow overlapping sounds
 */
export function playDrumSound(): void {
    if (!audioEnabled || audioPool.length === 0) {
        return;
    }

    const ctx: WechatMiniprogram.InnerAudioContext = audioPool[audioIndex];
    audioIndex = (audioIndex + 1) % AUDIO_POOL_SIZE;

    // Stop and replay from beginning
    ctx.stop();
    ctx.seek(0);
    ctx.play();
}

/**
 * Destroy audio pool
 * Clean up all audio contexts
 */
export function destroyAudioPool(): void {
    for (const ctx of audioPool) {
        ctx.destroy();
    }
    audioPool = [];
    audioIndex = 0;
}

/**
 * Set audio enabled state
 * @param enabled - Whether to enable audio
 */
export function setAudioEnabled(enabled: boolean): void {
    audioEnabled = enabled;
}

/**
 * Check if audio is enabled
 * @returns Whether audio is enabled
 */
export function isAudioEnabled(): boolean {
    return audioEnabled;
}
