/**
 * LLM Judgement Types
 * Type definitions for the synchronous LLM judgement module
 */

/**
 * Verdict result from LLM judgement
 */
export type TVerdict = 'host' | 'participant' | 'tie';

/**
 * Quote source identifier
 */
export type TQuoteFrom = 'host' | 'participant';

/**
 * A single quote extracted from one party's text
 */
export interface ILlmQuote {
    from: TQuoteFrom;
    text: string;
}

/**
 * LLM judgement result structure
 * Returned directly by the synchronous API
 */
export interface ILlmJudgementResult {
    /** Who wins the judgement */
    verdict: TVerdict;
    /** Reasons for the verdict */
    reasons: string[];
    /** Suggestions for improvement */
    suggestions: string[];
    /** Relevant quotes from each party */
    quotes: ILlmQuote[];
}

/**
 * Create judgement request payload (synchronous)
 */
export interface ICreateJudgementRequest {
    hostText: string;
    participantText: string;
}
