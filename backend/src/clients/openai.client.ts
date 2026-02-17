/**
 * OpenAI Client
 * Encapsulates LLM calls for judgment verdict (判决书)
 *
 * ARCHITECTURE: Client layer (infrastructure)
 * - Called by LlmJudgementService
 * - Reads config from OPENAI_CONFIG
 * - Timeout + JSON parsing with clear error messages
 */

import crypto from 'crypto';

import OpenAI from 'openai';

import { OPENAI_CONFIG } from '../constants/config';
import {
    JUDGMENT_SYSTEM_PROMPT,
    buildJudgmentUserContent,
} from '../constants/prompts';
import type {
    IJudgmentResponse,
    IRadarScores,
    IThirdPartyFactor,
} from '../types/llm';

/** Request timeout (ms) — abort if OpenAI takes longer */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Create a singleton OpenAI client instance
 */
function createClient(): OpenAI {
    if (!OPENAI_CONFIG.API_KEY) {
        throw new Error('OPENAI_API_KEY 未配置，无法调用 LLM');
    }

    return new OpenAI({
        apiKey: OPENAI_CONFIG.API_KEY,
        ...(OPENAI_CONFIG.BASE_URL ? { baseURL: OPENAI_CONFIG.BASE_URL } : {}),
        timeout: REQUEST_TIMEOUT_MS,
    });
}

let clientInstance: OpenAI | null = null;

function getClient(): OpenAI {
    if (!clientInstance) {
        clientInstance = createClient();
    }
    return clientInstance;
}

/* ========================================================
 * 清汤大老爷判决书 — Judgment Verdict
 * ====================================================== */

/** Radar chart dimension keys */
const RADAR_KEYS: (keyof IRadarScores)[] = [
    '嘴硬程度',
    '翻旧账',
    '逻辑滑坡',
    '撒娇暴击',
    '求生欲',
    '受害者演技',
];

/**
 * Validate that a number is in [0, 100]
 */
function isScore(v: unknown): v is number {
    return typeof v === 'number' && v >= 0 && v <= 100;
}

/**
 * Validate a radar-scores object
 */
function validateRadar(obj: unknown, label: string): IRadarScores {
    if (typeof obj !== 'object' || obj === null) {
        throw new Error(`${label} 必须是对象`);
    }
    const r = obj as Record<string, unknown>;
    const scores: Record<string, number> = {};
    for (const key of RADAR_KEYS) {
        if (!isScore(r[key])) {
            throw new Error(`${label}.${key} 必须是 0-100 的数字`);
        }
        scores[key] = r[key];
    }
    return scores as unknown as IRadarScores;
}

/**
 * Normalize responsibility values so player1 + player2 + factors = 100
 * Uses proportional scaling and rounds to integers.
 */
function normalizeResponsibility(
    player1: number,
    player2: number,
    factors: IThirdPartyFactor[]
): { player1: number; player2: number; factors: IThirdPartyFactor[] } {
    const factorSum: number = factors.reduce((sum, f) => sum + f.percentage, 0);
    const rawTotal: number = player1 + player2 + factorSum;

    // Already sums to 100 — no adjustment needed
    if (rawTotal === 100) {
        return { player1, player2, factors };
    }

    // Avoid division by zero (shouldn't happen in practice)
    if (rawTotal === 0) {
        return {
            player1: 50,
            player2: 50,
            factors: factors.map(f => ({ ...f, percentage: 0 })),
        };
    }

    const scale: number = 100 / rawTotal;

    // Scale and floor everything first
    const scaledP1: number = Math.round(player1 * scale);
    const scaledP2: number = Math.round(player2 * scale);
    const scaledFactors: IThirdPartyFactor[] = factors.map(f => ({
        ...f,
        percentage: Math.round(f.percentage * scale),
    }));
    const scaledFactorSum: number = scaledFactors.reduce(
        (sum, f) => sum + f.percentage,
        0
    );

    // Fix rounding drift by adjusting the largest bucket (player1 or player2)
    const drift: number = scaledP1 + scaledP2 + scaledFactorSum - 100;
    if (drift !== 0) {
        if (scaledP1 >= scaledP2) {
            return {
                player1: scaledP1 - drift,
                player2: scaledP2,
                factors: scaledFactors,
            };
        }
        return {
            player1: scaledP1,
            player2: scaledP2 - drift,
            factors: scaledFactors,
        };
    }

    return {
        player1: scaledP1,
        player2: scaledP2,
        factors: scaledFactors,
    };
}

/**
 * Validate that parsed JSON conforms to IJudgmentResponse
 */
function validateJudgment(obj: unknown): IJudgmentResponse {
    if (typeof obj !== 'object' || obj === null) {
        throw new Error('LLM 返回值不是 JSON 对象');
    }
    const rec = obj as Record<string, unknown>;

    // caseNumber
    if (typeof rec.caseNumber !== 'string') {
        throw new Error('caseNumber 必须是字符串');
    }

    // responsibility
    if (typeof rec.responsibility !== 'object' || rec.responsibility === null) {
        throw new Error('responsibility 必须是对象');
    }
    const resp = rec.responsibility as Record<string, unknown>;
    if (typeof resp.player1 !== 'number') {
        throw new Error('responsibility.player1 必须是数字');
    }
    if (typeof resp.player2 !== 'number') {
        throw new Error('responsibility.player2 必须是数字');
    }
    if (typeof resp.thirdParty !== 'object' || resp.thirdParty === null) {
        throw new Error('responsibility.thirdParty 必须是对象');
    }
    const tp = resp.thirdParty as Record<string, unknown>;
    if (!Array.isArray(tp.factors)) {
        throw new Error('responsibility.thirdParty.factors 必须是数组');
    }
    const factors: IThirdPartyFactor[] = tp.factors.map(
        (f: unknown, i: number) => {
            if (typeof f !== 'object' || f === null) {
                throw new Error(`factors[${i}] 必须是对象`);
            }
            const fr = f as Record<string, unknown>;
            if (typeof fr.name !== 'string') {
                throw new Error(`factors[${i}].name 必须是字符串`);
            }
            if (typeof fr.percentage !== 'number') {
                throw new Error(`factors[${i}].percentage 必须是数字`);
            }
            return {
                name: fr.name,
                percentage: fr.percentage,
            };
        }
    );

    // radarChart
    if (typeof rec.radarChart !== 'object' || rec.radarChart === null) {
        throw new Error('radarChart 必须是对象');
    }
    const radar = rec.radarChart as Record<string, unknown>;
    const p1Radar = validateRadar(radar.player1, 'radarChart.player1');
    const p2Radar = validateRadar(radar.player2, 'radarChart.player2');

    // verdict
    if (typeof rec.verdict !== 'string') {
        throw new Error('verdict 必须是字符串');
    }

    // punishmentTask
    if (typeof rec.punishmentTask !== 'string') {
        throw new Error('punishmentTask 必须是字符串');
    }

    // Normalize responsibility so total = 100
    const normalized = normalizeResponsibility(
        resp.player1,
        resp.player2,
        factors
    );

    return {
        caseNumber: rec.caseNumber,
        responsibility: {
            player1: normalized.player1,
            player2: normalized.player2,
            thirdParty: { factors: normalized.factors },
        },
        radarChart: {
            player1: p1Radar,
            player2: p2Radar,
        },
        verdict: rec.verdict,
        punishmentTask: rec.punishmentTask,
    };
}

/**
 * Call OpenAI to produce a judgment verdict (判决书)
 *
 * Uses temperature 0.7 for creative/humorous output
 *
 * @param player1Speech - Player 1's speech content
 * @param player2Speech - Player 2's speech content
 * @returns Parsed and validated IJudgmentResponse
 * @throws Error with human-readable message on failure
 */
export async function createJudgmentVerdict(
    player1Speech: string,
    player2Speech: string,
    idempotencyKey?: string
): Promise<IJudgmentResponse> {
    const client = getClient();

    const userContent = buildJudgmentUserContent(player1Speech, player2Speech);
    const key = idempotencyKey ?? crypto.randomUUID();

    const response = await client.chat.completions.create(
        {
            model: OPENAI_CONFIG.MODEL,
            messages: [
                {
                    role: 'system',
                    content: JUDGMENT_SYSTEM_PROMPT,
                },
                { role: 'user', content: userContent },
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' },
        },
        { idempotencyKey: key }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error('OpenAI 返回空内容');
    }

    // Parse JSON — strip possible markdown fences
    const cleaned = content
        .replace(/^```json?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    let parsed: unknown;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        throw new Error('OpenAI 返回的不是有效 JSON: ' + cleaned.slice(0, 200));
    }

    return validateJudgment(parsed);
}
