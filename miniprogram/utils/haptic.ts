/**
 * Haptic Feedback Utilities
 * Vibration feedback for drum room interactions
 */

import { logger } from './logger';

/**
 * Trigger short vibration (15ms)
 * Used for tap feedback
 */
export function vibrateShort(): void {
    wx.vibrateShort({
        type: 'medium',
        fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
            logger.warn('Haptic', 'vibrateShort failed:', err.errMsg);
        },
    });
}

/**
 * Trigger long vibration (400ms)
 * Used for important events like game start/end
 */
export function vibrateLong(): void {
    wx.vibrateLong({
        fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
            logger.warn('Haptic', 'vibrateLong failed:', err.errMsg);
        },
    });
}
