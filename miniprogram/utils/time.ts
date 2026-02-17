/**
 * Time Utilities
 * Countdown and server time offset calculation utilities
 */

/** Server time offset in milliseconds (serverTime - localTime) */
let serverTimeOffsetMs: number = 0;

/**
 * Set server time offset
 * Call this when receiving server timestamp to calibrate local time
 * @param serverTimeMs - Server timestamp in milliseconds
 * @param receivedAtMs - Optional: client time when message was received
 *                       Use this for queued messages to avoid queue delay
 */
export function setServerTimeOffset(
    serverTimeMs: number,
    receivedAtMs?: number
): void {
    const clientTimeMs: number = receivedAtMs ?? Date.now();
    serverTimeOffsetMs = serverTimeMs - clientTimeMs;
    console.log(
        `[Time] Server offset set to ${serverTimeOffsetMs}ms (serverTime: ${serverTimeMs}, clientTime: ${clientTimeMs})`
    );
}

/**
 * Get current server time
 * @returns Current time adjusted by server offset
 */
export function nowServerMs(): number {
    return Date.now() + serverTimeOffsetMs;
}

/**
 * Get time remaining until target time
 * @param targetMs - Target timestamp in milliseconds (server time)
 * @returns Remaining milliseconds (0 if already passed)
 */
export function getTimeRemainingMs(targetMs: number): number {
    const remaining: number = targetMs - nowServerMs();
    return remaining > 0 ? remaining : 0;
}

/**
 * Get time remaining in seconds (rounded up)
 * @param targetMs - Target timestamp in milliseconds (server time)
 * @returns Remaining seconds (ceiling)
 */
export function getTimeRemainingSec(targetMs: number): number {
    const remainingMs: number = getTimeRemainingMs(targetMs);
    return Math.ceil(remainingMs / 1000);
}
