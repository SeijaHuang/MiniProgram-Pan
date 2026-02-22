import { DEBUG, ENV } from '../constants/env';

type LogLevel = 'log' | 'warn' | 'error';

function print(level: LogLevel, tag: string, ...args: unknown[]): void {
    if (level !== 'error' && !DEBUG) return;
    const prefix = `[${ENV}][${tag}]`;
    console[level](prefix, ...args);
}

export const logger = {
    log: (tag: string, ...args: unknown[]) => print('log', tag, ...args),
    warn: (tag: string, ...args: unknown[]) => print('warn', tag, ...args),
    error: (tag: string, ...args: unknown[]) => print('error', tag, ...args),
};
