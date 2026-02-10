/**
 * OpenAI Client
 * Encapsulates LLM calls for the judgement worker
 *
 * ARCHITECTURE: Client layer (infrastructure)
 * - ONLY imported by the Worker process
 * - NEVER imported by HTTP controllers or services
 * - Reads config from OPENAI_CONFIG
 * - Timeout + JSON parsing with clear error messages
 */

import OpenAI from 'openai';

import { OPENAI_CONFIG } from '../constants/config';
import type { ILlmJudgementResult, TVerdict } from '../types/llm';

/** Request timeout (ms) — abort if OpenAI takes longer */
const REQUEST_TIMEOUT_MS = 60_000;

const SYSTEM_PROMPT = `你是一位中立、公正的裁决者。
用户会给你两段文字：host（主持方）和 participant（参与方）。
你必须判断哪一方更有道理，并以严格的 JSON 格式输出结果。

输出格式（不要添加任何 Markdown 标记或额外文字）：
{
  "verdict": "host" | "participant" | "tie",
  "reasons": ["原因1", "原因2"],
  "suggestions": ["建议1"],
  "quotes": {
    "host": ["引用1"],
    "participant": ["引用1"]
  }
}`;

/**
 * Validate that a parsed object conforms to ILlmJudgementResult
 * Throws if validation fails
 */
function validateResult(obj: unknown): ILlmJudgementResult {
    if (typeof obj !== 'object' || obj === null) {
        throw new Error('LLM 返回值不是 JSON 对象');
    }

    const record = obj as Record<string, unknown>;

    // verdict
    const validVerdicts: TVerdict[] = ['host', 'participant', 'tie'];
    if (
        typeof record.verdict !== 'string' ||
        !validVerdicts.includes(record.verdict as TVerdict)
    ) {
        throw new Error(
            `verdict 必须是 host/participant/tie，实际: ${String(record.verdict)}`
        );
    }

    // reasons — must be string[]
    if (
        !Array.isArray(record.reasons) ||
        !record.reasons.every((r: unknown) => typeof r === 'string')
    ) {
        throw new Error('reasons 必须是字符串数组');
    }

    // suggestions — must be string[]
    if (
        !Array.isArray(record.suggestions) ||
        !record.suggestions.every((s: unknown) => typeof s === 'string')
    ) {
        throw new Error('suggestions 必须是字符串数组');
    }

    // quotes
    if (typeof record.quotes !== 'object' || record.quotes === null) {
        throw new Error('quotes 必须是对象');
    }
    const quotes = record.quotes as Record<string, unknown>;
    if (
        !Array.isArray(quotes.host) ||
        !quotes.host.every((q: unknown) => typeof q === 'string')
    ) {
        throw new Error('quotes.host 必须是字符串数组');
    }
    if (
        !Array.isArray(quotes.participant) ||
        !quotes.participant.every((q: unknown) => typeof q === 'string')
    ) {
        throw new Error('quotes.participant 必须是字符串数组');
    }

    return {
        verdict: record.verdict as TVerdict,
        reasons: record.reasons,
        suggestions: record.suggestions,
        quotes: {
            host: quotes.host,
            participant: quotes.participant,
        },
    };
}

/**
 * Create a singleton OpenAI client instance
 */
function createClient(): OpenAI {
    if (!OPENAI_CONFIG.API_KEY) {
        throw new Error('OPENAI_API_KEY 未配置，无法启动 Worker');
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

/**
 * Call OpenAI to produce a judgement result
 *
 * @param hostText        - Text from the host (room creator)
 * @param participantText - Text from the participant (joiner)
 * @returns Parsed and validated ILlmJudgementResult
 * @throws Error with human-readable message on any failure
 */
export async function createJudgement(
    hostText: string,
    participantText: string
): Promise<ILlmJudgementResult> {
    const client = getClient();

    const userContent = JSON.stringify(
        { host: hostText, participant: participantText },
        null,
        2
    );

    const response = await client.chat.completions.create({
        model: OPENAI_CONFIG.MODEL,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
    });

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
        throw new Error(`OpenAI 返回的不是有效 JSON: ${cleaned.slice(0, 200)}`);
    }

    return validateResult(parsed);
}
