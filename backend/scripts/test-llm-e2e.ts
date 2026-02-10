/**
 * Minimal E2E self-test for the LLM Judgement pipeline
 *
 * Prerequisites:
 *   1. PostgreSQL running with DATABASE_URL configured
 *   2. Migrations applied: npx prisma migrate deploy
 *   3. API server running: npm run dev
 *   4. (Optional) Worker running: npm run worker:llm
 *
 * Usage:
 *   npm run test:llm
 *
 * Tests:
 *   1. Idempotency — same idempotencyKey returns same taskId
 *   2. Task query — GET returns correct status
 *   3. Worker pickup — task transitions queued → running → succeeded/failed
 *      (only if worker is running)
 */

/* eslint-disable no-console */

const API_BASE = process.env.API_BASE || 'http://localhost:8080';

interface IApiResponse<T> {
    success: boolean;
    data?: T;
    error?: { code: string; message: string };
}

interface ICreateData {
    taskId: string;
    status: string;
}

interface IGetData {
    taskId: string;
    status: string;
    resultJson: unknown;
    errorMessage: string | null;
}

let passed = 0;
let failed = 0;

function assert(
    condition: boolean,
    label: string,
    detail?: string
): void {
    if (condition) {
        console.log(`  PASS: ${label}`);
        passed++;
    } else {
        console.error(
            `  FAIL: ${label}${detail ? ` — ${detail}` : ''}`
        );
        failed++;
    }
}

async function post<T>(
    path: string,
    body: Record<string, unknown>
): Promise<IApiResponse<T>> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return (await res.json()) as IApiResponse<T>;
}

async function get<T>(path: string): Promise<IApiResponse<T>> {
    const res = await fetch(`${API_BASE}${path}`);
    return (await res.json()) as IApiResponse<T>;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
    console.log(`\n=== LLM Judgement E2E Test ===`);
    console.log(`API: ${API_BASE}\n`);

    // -------------------------------------------------------
    // Prepare: create a room so roomId is valid
    // -------------------------------------------------------
    console.log('[Setup] Creating room...');
    const roomRes = await post<{
        room: { roomId: string; roomCode: string };
    }>('/room/create', {
        creator: { userId: 'test_host', nickname: 'TestHost' },
    });

    if (!roomRes.success || !roomRes.data) {
        console.error(
            'Cannot create room — is the server running?',
            roomRes
        );
        process.exit(1);
    }
    const roomId = roomRes.data.room.roomId;
    console.log(`[Setup] roomId=${roomId}\n`);

    const idempotencyKey = `test_${Date.now()}`;

    // -------------------------------------------------------
    // Test 1: Create task
    // -------------------------------------------------------
    console.log('[Test 1] Create judgement task');
    const create1 = await post<ICreateData>(
        `/v1/rooms/${roomId}/llm/judgement`,
        {
            hostText: '我每天加班到很晚，非常辛苦',
            participantText: '我也很辛苦，而且工资更低',
            idempotencyKey,
        }
    );
    assert(create1.success === true, 'create returns success');
    assert(
        typeof create1.data?.taskId === 'string',
        'taskId is a string'
    );
    assert(
        create1.data?.status === 'queued',
        `status is queued (got: ${create1.data?.status})`
    );
    const taskId = create1.data?.taskId ?? '';

    // -------------------------------------------------------
    // Test 2: Idempotency
    // -------------------------------------------------------
    console.log('\n[Test 2] Idempotency — same key returns same task');
    const create2 = await post<ICreateData>(
        `/v1/rooms/${roomId}/llm/judgement`,
        {
            hostText: '我每天加班到很晚，非常辛苦',
            participantText: '我也很辛苦，而且工资更低',
            idempotencyKey,
        }
    );
    assert(create2.success === true, 'second create returns success');
    assert(
        create2.data?.taskId === taskId,
        `same taskId (${create2.data?.taskId} === ${taskId})`
    );

    // -------------------------------------------------------
    // Test 3: GET task
    // -------------------------------------------------------
    console.log('\n[Test 3] GET task by ID');
    const getRes = await get<IGetData>(`/v1/llm/tasks/${taskId}`);
    assert(getRes.success === true, 'get returns success');
    assert(
        getRes.data?.taskId === taskId,
        'returned taskId matches'
    );

    // -------------------------------------------------------
    // Test 4: GET non-existent task → 404
    // -------------------------------------------------------
    console.log('\n[Test 4] GET non-existent task → 404');
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const notFound = await get<IGetData>(`/v1/llm/tasks/${fakeId}`);
    assert(
        notFound.success === false,
        'non-existent task returns failure'
    );
    assert(
        notFound.error?.code === 'TASK_NOT_FOUND',
        `error code is TASK_NOT_FOUND (got: ${notFound.error?.code})`
    );

    // -------------------------------------------------------
    // Test 5: Worker pickup (optional — only if worker is running)
    // -------------------------------------------------------
    console.log(
        '\n[Test 5] Worker pickup (polling up to 30s, skip if no worker)'
    );
    let finalStatus = getRes.data?.status ?? 'queued';
    const deadline = Date.now() + 30_000;
    let workerDetected = false;

    while (
        Date.now() < deadline &&
        (finalStatus === 'queued' || finalStatus === 'running')
    ) {
        await sleep(1000);
        const poll = await get<IGetData>(`/v1/llm/tasks/${taskId}`);
        finalStatus = poll.data?.status ?? finalStatus;

        if (finalStatus === 'running' && !workerDetected) {
            console.log('  ... worker picked up task (running)');
            workerDetected = true;
        }
    }

    if (
        finalStatus === 'succeeded' ||
        finalStatus === 'failed'
    ) {
        assert(true, `task reached terminal state: ${finalStatus}`);
        if (finalStatus === 'succeeded') {
            const finalGet = await get<IGetData>(
                `/v1/llm/tasks/${taskId}`
            );
            assert(
                finalGet.data?.resultJson !== null,
                'resultJson is populated'
            );
        }
    } else {
        console.log(
            `  SKIP: task still ${finalStatus} — worker may not be running`
        );
    }

    // -------------------------------------------------------
    // Summary
    // -------------------------------------------------------
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
    console.error('Test script crashed:', err);
    process.exit(1);
});
