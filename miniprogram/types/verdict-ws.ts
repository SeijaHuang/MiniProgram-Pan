/**
 * Verdict WebSocket Types (Frontend)
 * Payload types for speech turn management and verdict delivery messages
 *
 * These match the backend types in backend/src/types/websocket/verdict.ts
 */

/**
 * SPEECH_TURN_SWITCH payload (Server → Client)
 * Broadcast when first speaker finishes, notifying turn switch
 */
export interface ISpeechTurnSwitchPayload {
    roomId: string;
    nextSpeakerUserId: string;
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
    userId: string;
    highestDimension: string;
    advice: string;
}

/**
 * Backend verdict result structure
 * Matches the IVerdictResult in backend/src/types/websocket/verdict.ts
 */
export interface IBackendVerdictResult {
    caseNumber: string;
    winnerId: string; // userId
    loserId: string; // userId
    responsibility: {
        players: Array<{
            userId: string;
            nickname: string;
            percentage: number;
        }>;
        thirdParty: {
            factors: IBackendThirdPartyFactor[];
        };
    };
    radarChart: Array<{
        userId: string;
        nickname: string;
        scores: IBackendDimensionScores;
    }>;
    verdict: string;
    punishmentTask: {
        loserUserId: string;
        loserNickname: string;
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
