import { WebSocket } from 'ws';

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || 'localhost';
const PATH = process.env.WS_PATH || '/ws';

const url = `ws://${HOST}:${PORT}${PATH}`;

console.log(`Connecting to ${url} ...`);

const ws = new WebSocket(url);

ws.on('open', () => {
    console.log('[client] connected');

    const payload = {
        type: 'ping',
        clientTs: Date.now(),
        message: 'hello from ws-test.ts',
    };

    console.log('[client] sending:', payload);
    ws.send(JSON.stringify(payload));
});

ws.on('message', data => {
    try {
        const text =
            typeof data === 'string'
                ? data
                : Buffer.isBuffer(data)
                  ? data.toString('utf8')
                  : Array.isArray(data)
                    ? Buffer.concat(data).toString('utf8')
                    : Buffer.from(data).toString('utf8');

        console.log('[client] message from server:', text);
    } catch (e) {
        console.error('[client] failed to parse message', e);
    }
});

ws.on('close', (code, reason) => {
    console.log('[client] closed', { code, reason: reason.toString() });
    process.exit(0);
});

ws.on('error', err => {
    console.error('[client] error:', err);
});
