import { Server, type RawData } from 'ws';
import type { Server as HttpServer } from 'http';

function rawDataToText(data: RawData): string {
    if (typeof data === 'string') return data;
    if (Buffer.isBuffer(data)) return data.toString('utf8');
    if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
    // ArrayBuffer
    return Buffer.from(data).toString('utf8');
}

export function initWebSocket(server: HttpServer) {
    const wss = new Server({ server, path: '/ws' });

    wss.on('connection', ws => {
        console.log('ws connected');

        ws.send(
            JSON.stringify({
                type: 'welcome',
                ts: Date.now(),
            })
        );

        ws.on('message', (data: RawData) => {
            try {
                const msg = JSON.parse(rawDataToText(data));
                ws.send(
                    JSON.stringify({
                        ...msg,
                        serverTs: Date.now(),
                    })
                );
            } catch {
                ws.send(
                    JSON.stringify({
                        type: 'error',
                        message: 'invalid_json',
                    })
                );
            }
        });

        ws.on('close', () => {
            console.log('ws closed');
        });
    });
}
