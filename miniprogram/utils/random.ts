/**
 * Random Utilities
 * Random text and trajectory generation for drum room
 */

/** Fly text options for drum tap feedback */
const FLY_TEXTS: string[] = [
    '冤啊！',
    '好痛！',
    '噔！',
    '咚咚！',
    '有冤！',
    '求审！',
    '击鼓！',
    '呜呼！',
    '青天！',
    '大人！',
];

/**
 * Get random fly text for drum tap
 * @returns Random text string
 */
export function getRandomFlyText(): string {
    const index: number = Math.floor(Math.random() * FLY_TEXTS.length);
    return FLY_TEXTS[index];
}

/**
 * Get random number in range
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (exclusive)
 * @returns Random number in range
 */
export function getRandomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

/**
 * Get random integer in range
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns Random integer in range
 */
export function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random fly text trajectory
 * @returns Object with x offset, y offset, and rotation
 */
export function getRandomTrajectory(): {
    offsetX: number;
    offsetY: number;
    rotate: number;
} {
    return {
        offsetX: getRandomInRange(-100, 100), // rpx offset from center
        offsetY: getRandomInRange(-80, 80), // initial y offset
        rotate: getRandomInRange(-25, 25), // rotation degrees
    };
}

/**
 * Generate unique ID for fly text
 * @returns Unique string ID
 */
export function generateFlyTextId(): string {
    return `fly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
