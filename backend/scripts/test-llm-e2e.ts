/**
 * Minimal E2E self-test for the Judgment Verdict API (判决书)
 *
 * Prerequisites:
 *   1. API server running: npm run dev
 *   2. OPENAI_API_KEY configured in .env
 *
 * Usage:
 *   npm run test:llm
 *
 * Tests:
 *   1. Validation — missing fields returns 400
 *   2. Validation — empty strings return 400
 *   3. Judgment verdict — POST returns 200 with result
 *      (only if OPENAI_API_KEY is configured on server)
 */

/* eslint-disable no-console */

const API_BASE = process.env.API_BASE || 'http://localhost:8080';

interface IApiResponse<T> {
    success: boolean;
    data?: T;
    error?: { code: string; message: string };
}

interface IJudgmentResult {
    caseNumber: string;
    responsibility: {
        player1: number;
        player2: number;
        thirdParty: {
            factors: Array<{
                name: string;
                percentage: number;
            }>;
        };
    };
    radarChart: {
        player1: Record<string, number>;
        player2: Record<string, number>;
    };
    verdict: string;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
    if (condition) {
        console.log(`  PASS: ${label}`);
        passed++;
    } else {
        console.error(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
        failed++;
    }
}

async function post<T>(
    path: string,
    body: Record<string, unknown>
): Promise<{ status: number; json: IApiResponse<T> }> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const json = (await res.json()) as IApiResponse<T>;
    return { status: res.status, json };
}

async function main(): Promise<void> {
    console.log(`\n=== Judgment Verdict E2E Test ===`);
    console.log(`API: ${API_BASE}\n`);

    // Setup: create a room so roomId is valid
    console.log('[Setup] Creating room...');
    const roomRes = await post<{
        room: { roomId: string; roomCode: string };
    }>('/room/create', {
        creator: {
            userId: 'test_host',
            nickname: 'TestHost',
        },
    });

    if (!roomRes.json.success || !roomRes.json.data) {
        console.error(
            'Cannot create room — is the server running?',
            roomRes.json
        );
        process.exit(1);
    }
    const roomId = roomRes.json.data.room.roomId;
    console.log(`[Setup] roomId=${roomId}\n`);

    const url = `/v1/rooms/${roomId}/llm/judgment`;

    // ---------------------------------------------------
    // Test 1: Missing fields → 400
    // ---------------------------------------------------
    console.log('[Test 1] Missing fields → 400');
    const t1 = await post(url, {});
    assert(t1.status === 400, `status is 400 (got: ${t1.status})`);
    assert(t1.json.success === false, 'response.success is false');

    // ---------------------------------------------------
    // Test 2: Empty player1Speech → 400
    // ---------------------------------------------------
    console.log('\n[Test 2] Empty player1Speech → 400');
    const t2 = await post(url, {
        player1Speech: '',
        player2Speech: '有内容',
    });
    assert(t2.status === 400, `status is 400 (got: ${t2.status})`);

    // ---------------------------------------------------
    // Test 3: Judgment verdict → 200
    // ---------------------------------------------------
    console.log('\n[Test 3] Judgment verdict → 200');
    console.log('  (calls OpenAI — may take up to 60s...)');
    const t3 = await post<IJudgmentResult>(url, {
        player1Speech: '我每天加班到很晚，非常辛苦',
        player2Speech: '我也很辛苦，而且工资更低',
    });

    if (t3.status === 502) {
        console.log(
            '  SKIP: server returned 502 — ' +
                'OPENAI_API_KEY may not be configured'
        );
    } else {
        assert(t3.status === 200, `status is 200 (got: ${t3.status})`);
        assert(t3.json.success === true, 'response.success is true');

        const data = t3.json.data;
        if (data) {
            assert(
                typeof data.caseNumber === 'string',
                `caseNumber is string (got: ${data.caseNumber})`
            );
            assert(
                typeof data.responsibility.player1 === 'number',
                'responsibility.player1 is number'
            );
            assert(
                typeof data.responsibility.player2 === 'number',
                'responsibility.player2 is number'
            );
            assert(
                Array.isArray(data.responsibility.thirdParty.factors),
                'thirdParty.factors is array'
            );
            assert(
                typeof data.radarChart.player1 === 'object',
                'radarChart.player1 is object'
            );
            assert(
                typeof data.radarChart.player2 === 'object',
                'radarChart.player2 is object'
            );
            assert(
                typeof data.verdict === 'string' && data.verdict.length > 0,
                'verdict is non-empty string'
            );
        }
    }

    // ---------------------------------------------------
    // Summary
    // ---------------------------------------------------
    console.log(`\n=== Results: ${passed} passed, ` + `${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
    console.error('Test script crashed:', err);
    process.exit(1);
});
