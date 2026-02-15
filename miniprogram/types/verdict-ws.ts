/**
 * Verdict WebSocket Types (Frontend)
 * Payload types for speech turn management and verdict delivery messages
 *
 * These match the backend types in backend/src/types/websocket/verdict.ts
 */

/**
 * SPEECH_TURN_END payload (Client → Server)
 * Sent when a player finishes their 60-second speech turn
 */
export interface ISpeechTurnEndPayload {
    roomId: string;
    userId: string;
}

/**
 * SPEECH_TURN_SWITCH payload (Server → Client)
 * Broadcast when first speaker finishes, notifying turn switch
 */
export interface ISpeechTurnSwitchPayload {
    roomId: string;
}

/**
 * CHAT_COMPLETE payload (Server → Client)
 * Broadcast when both players have finished speaking
 */
export interface IChatCompletePayload {
    roomId: string;
}

/**
 * Backend dimension scores format
 * NOTE: Field names differ from frontend IDimensionScores
 */
export interface IBackendDimensionScores {
    mouthHard: number;
    oldAccountDigging: number;
    logicFallacy: number;
    coquettishDamage: number;
    survivalInstinct: number;
    victimActing: number;
}

/**
 * Backend third-party factor format
 */
export interface IBackendThirdPartyFactor {
    name: string;
    percentage: number;
    emoji: string;
}

/**
 * Backend secret report format
 */
export interface IBackendSecretReport {
    role: 'host' | 'guest';
    highestDimension: string;
    advice: string;
}

/**
 * Backend verdict result structure
 * Matches the IVerdictResult in backend/src/types/websocket/verdict.ts
 */
export interface IBackendVerdictResult {
    caseNumber: string;
    winnerId: 'host' | 'guest';
    loserId: 'host' | 'guest';
    responsibility: {
        host: number;
        guest: number;
        thirdParty: {
            factors: IBackendThirdPartyFactor[];
        };
    };
    radarChart: {
        host: IBackendDimensionScores;
        guest: IBackendDimensionScores;
    };
    verdict: string;
    punishmentTask: {
        role: 'host' | 'guest';
        task: string;
    };
    secretReports: IBackendSecretReport[];
}

/**
 * VERDICT_RESULT payload (Server → Client)
 * Contains the backend verdict format (needs mapping to frontend IVerdictResult)
 */
export interface IVerdictResultPayload {
    roomId: string;
    verdict: IBackendVerdictResult;
}

/**
 * VERDICT_FAILED payload (Server → Client)
 * Sent when LLM verdict generation fails
 */
export interface IVerdictFailedPayload {
    roomId: string;
    error: string;
    canRetry: boolean;
    retryCount: number;
}

/**
 * VERDICT_RETRY payload (Client → Server)
 * Sent to request verdict retry after failure
 */
export interface IVerdictRetryPayload {
    roomId: string;
    userId: string;
}
