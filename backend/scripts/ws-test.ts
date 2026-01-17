/**
 * WebSocket Test Script
 * Tests the WebSocket server with the new message protocol
 */

import { WebSocket } from 'ws';

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || 'localhost';
const PATH = process.env.WS_PATH || '/ws';

const url = `ws://${HOST}:${PORT}${PATH}`;

interface IMessage {
    type: string;
    data: unknown;
    timestamp: number;
}

function createMessage(type: string, data: unknown): string {
    const message: IMessage = {
        type,
        data,
        timestamp: Date.now(),
    };
    return JSON.stringify(message);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests(): Promise<void> {
    console.log(`\n🚀 Starting WebSocket Test...`);
    console.log(`📡 Connecting to ${url}\n`);

    const ws = new WebSocket(url);
    let roomId = '';

    ws.on('open', async () => {
        console.log('✅ Connected to WebSocket server\n');

        // Test 1: Wait for welcome message
        await sleep(500);

        // Test 2: Create Room
        console.log('📤 Test 1: Creating room...');
        ws.send(
            createMessage('room:create', {
                playerName: 'Test Player 1',
                playerAvatar: 'https://example.com/avatar.png',
            })
        );
        await sleep(2000);

        // Test 3: Send Heartbeat
        console.log('📤 Test 2: Sending heartbeat...');
        ws.send(
            createMessage('heartbeat', {
                timestamp: Date.now(),
            })
        );
        await sleep(2000);

        // Test 4: Invalid Message Type
        console.log('📤 Test 3: Sending invalid message type...');
        ws.send(
            createMessage('invalid:type', {
                test: 'data',
            })
        );
        await sleep(2000);

        console.log('✅ All tests completed!\n');
        ws.close();
    });

    ws.on('message', (data) => {
        try {
            const text =
                typeof data === 'string'
                    ? data
                    : Buffer.isBuffer(data)
                      ? data.toString('utf8')
                      : Array.isArray(data)
                        ? Buffer.concat(data).toString('utf8')
                        : Buffer.from(data).toString('utf8');

            const message = JSON.parse(text) as IMessage;

            console.log(`📩 Received: ${message.type}`);
            console.log(JSON.stringify(message, null, 2));
            console.log('---\n');

            // Store room ID for later tests
            if (message.type === 'room:created' && message.data) {
                const data = message.data as { room: { id: string } };
                roomId = data.room.id;
                console.log(`✅ Room created: ${roomId}\n`);
            }
        } catch (error) {
            console.error('❌ Failed to parse message:', error);
        }
    });

    ws.on('close', (code, reason) => {
        console.log(
            `👋 WebSocket connection closed (Code: ${code}, Reason: ${reason.toString()})`
        );
        process.exit(0);
    });

    ws.on('error', (err) => {
        console.error('❌ WebSocket error:', err);
        process.exit(1);
    });
}

// Run tests
runTests().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});

