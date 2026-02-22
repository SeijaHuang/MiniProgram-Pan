/**
 * Logger Utility
 * Environment-aware logging for backend services
 *
 * - log/warn: only output in non-production environments
 * - error: always output regardless of environment
 */

type LogLevel = 'log' | 'warn' | 'error';

const DEBUG: boolean = process.env.NODE_ENV !== 'production';
const ENV: string = process.env.NODE_ENV ?? 'development';

function print(level: LogLevel, tag: string, ...args: unknown[]): void {
    if (level !== 'error' && !DEBUG) return;
    const prefix = `[${ENV}][${tag}]`;
    console[level](prefix, ...args);
}

export const logger = {
    log: (tag: string, ...args: unknown[]): void => print('log', tag, ...args),
    warn: (tag: string, ...args: unknown[]): void =>
        print('warn', tag, ...args),
    error: (tag: string, ...args: unknown[]): void =>
        print('error', tag, ...args),
};
