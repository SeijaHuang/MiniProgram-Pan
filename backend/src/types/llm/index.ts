/**
 * LLM Judgement Types
 * Type definitions for the LLM judgement module
 */

/**
 * Verdict result from LLM judgement
 */
export type TVerdict = 'host' | 'participant' | 'tie';

/**
 * LLM judgement result structure
 * This is the schema that resultJson must conform to
 */
export interface ILlmJudgementResult {
    /** Who wins the judgement */
    verdict: TVerdict;
    /** Reasons for the verdict */
    reasons: string[];
    /** Suggestions for improvement */
    suggestions: string[];
    /** Relevant quotes from each party */
    quotes: {
        host: string[];
        participant: string[];
    };
}

/**
 * LLM task status enum (mirrors Prisma enum)
 */
export enum ELlmTaskStatus {
    QUEUED = 'queued',
    RUNNING = 'running',
    SUCCEEDED = 'succeeded',
    FAILED = 'failed',
}

/**
 * LLM task representation
 */
export interface ILlmTask {
    id: string;
    roomId: string;
    idempotencyKey: string;
    status: ELlmTaskStatus;
    hostText: string;
    participantText: string;
    resultJson: ILlmJudgementResult | null;
    errorMessage: string | null;
    createdAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
}

/**
 * Create judgement request payload
 */
export interface ICreateJudgementRequest {
    hostText: string;
    participantText: string;
    idempotencyKey: string;
}

/**
 * Create judgement response data
 */
export interface ICreateJudgementResponseData {
    taskId: string;
    status: ELlmTaskStatus;
}

/**
 * Get task response data
 */
export interface IGetTaskResponseData {
    taskId: string;
    status: ELlmTaskStatus;
    resultJson: ILlmJudgementResult | null;
    errorMessage: string | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
}
