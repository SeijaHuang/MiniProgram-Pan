/**
 * Logger Utility
 * Winston-based structured logger for backend services
 *
 * Calling conventions:
 *   Legacy:     logger.log('Tag', 'message text', optionalError)
 *   Structured: logger.info('event.name', { key: value, ... })
 *
 * Structured mode activates when there is exactly one argument and it is a
 * plain (non-Error) object. This produces top-level JSON fields for
 * grep-ability (e.g. grep roomId in logs/combined.log).
 *
 * Transports:
 *   - Console: colorized readable format (dev) or JSON (prod)
 *   - logs/error.log: error level only, always JSON
 *   - logs/combined.log: all levels, always JSON
 *
 * Log level is controlled by LOG_LEVEL env var (default: info).
 */

import winston from 'winston';

const { combine, timestamp, errors, json, printf } = winston.format;

const isDev: boolean = process.env.NODE_ENV !== 'production';
const logLevel: string = process.env.LOG_LEVEL ?? 'info';

// ANSI color codes applied inline to avoid colorize() mutating the shared
// info object and corrupting JSON written to file transports.
const LEVEL_COLORS: Record<string, string> = {
    error: '\x1b[31m',
    warn: '\x1b[33m',
    info: '\x1b[32m',
    debug: '\x1b[36m',
    verbose: '\x1b[37m',
};
const RESET = '\x1b[0m';

/**
 * Human-readable format for development console.
 * Structured metadata is appended as inline JSON for easy scanning.
 */
const devConsoleFormat = combine(
    timestamp({ format: 'HH:mm:ss.SSS' }),
    errors({ stack: true }),
    printf((rawInfo: winston.Logform.TransformableInfo): string => {
        const info = rawInfo as Record<string, unknown>;
        const ts = String(info['timestamp'] ?? '');
        const levelStr = String(info['level'] ?? 'info');
        const color = LEVEL_COLORS[levelStr] ?? '';
        const coloredLevel = `${color}${levelStr}${RESET}`;
        const message = String(info['message'] ?? '');
        const tag = info['tag'] ? `[${String(info['tag'])}] ` : '';
        const stack =
            typeof info['stack'] === 'string' ? `\n${info['stack']}` : '';

        const known = new Set([
            'timestamp',
            'level',
            'message',
            'tag',
            'stack',
        ]);
        const rest: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(info)) {
            if (!known.has(k)) rest[k] = v;
        }
        const restPart =
            Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';

        return `${ts} ${coloredLevel} ${tag}${message}${restPart}${stack}`;
    })
);

const jsonFormat = combine(timestamp(), errors({ stack: true }), json());

const winstonLogger = winston.createLogger({
    level: logLevel,
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({
            format: isDev ? devConsoleFormat : jsonFormat,
        }),
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: jsonFormat,
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
            format: jsonFormat,
        }),
    ],
});

type LogMeta = Record<string, unknown>;

/**
 * Core log function used by all public methods.
 *
 * Two calling conventions:
 *   1. Structured: coreLog('info', 'event.name', [{ key: value }])
 *      → { level, message: 'event.name', key: value, ... }
 *   2. Legacy:     coreLog('info', 'Tag', ['message text', optionalError])
 *      → { level, message: 'message text', tag: 'Tag' }
 *
 * Structured mode activates when args contains exactly one plain object.
 */
function coreLog(
    level: 'info' | 'warn' | 'error',
    tagOrMessage: string,
    args: unknown[]
): void {
    // Structured call: logger.info('event', { key: value })
    if (
        args.length === 1 &&
        args[0] !== null &&
        typeof args[0] === 'object' &&
        !(args[0] instanceof Error)
    ) {
        const meta = args[0] as LogMeta;
        switch (level) {
            case 'info':
                winstonLogger.info(tagOrMessage, meta);
                break;
            case 'warn':
                winstonLogger.warn(tagOrMessage, meta);
                break;
            case 'error':
                winstonLogger.error(tagOrMessage, meta);
                break;
        }
        return;
    }

    // Legacy call: logger.log('Tag', 'message', ...args)
    const parts: string[] = [];
    let stack: string | undefined;

    for (const arg of args) {
        if (arg instanceof Error) {
            parts.push(arg.message);
            if (arg.stack) stack = arg.stack;
        } else if (typeof arg === 'string') {
            parts.push(arg);
        } else if (arg !== null && arg !== undefined) {
            parts.push(JSON.stringify(arg));
        }
    }

    const message = parts.join(' ');
    const meta: LogMeta = { tag: tagOrMessage };
    if (stack !== undefined) meta.stack = stack;

    switch (level) {
        case 'info':
            winstonLogger.info(message, meta);
            break;
        case 'warn':
            winstonLogger.warn(message, meta);
            break;
        case 'error':
            winstonLogger.error(message, meta);
            break;
    }
}

export const logger = {
    /** Legacy API: logger.log('Tag', 'message', ...args) */
    log: (tagOrMessage: string, ...args: unknown[]): void =>
        coreLog('info', tagOrMessage, args),

    /** Structured API: logger.info('event.name', { key: value }) */
    info: (tagOrMessage: string, ...args: unknown[]): void =>
        coreLog('info', tagOrMessage, args),

    /** Legacy + structured warn: logger.warn('Tag'|'event', ...) */
    warn: (tagOrMessage: string, ...args: unknown[]): void =>
        coreLog('warn', tagOrMessage, args),

    /** Legacy + structured error: logger.error('Tag'|'event', ...) */
    error: (tagOrMessage: string, ...args: unknown[]): void =>
        coreLog('error', tagOrMessage, args),
};
