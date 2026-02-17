/**
 * Verdict WebSocket Types
 * Types for speech turn management and verdict delivery
 */

import type { IWSMessage } from './base';
import { EWSMessageType } from './base';

/**
 * SPEECH_TURN_END: Client → Server
 * Sent when a player finishes their 60-second speech
 */
export interface ISpeechTurnEndData {
    roomId: string;
    userId: string;
}

export interface ISpeechTurnEndMessage extends IWSMessage<ISpeechTurnEndData> {
    type: EWSMessageType.SpeechTurnEnd;
}

/**
 * SPEECH_TURN_SWITCH: Server → Client
 * Broadcast when first speaker finishes, notifying turn switch
 */
export interface ISpeechTurnSwitchData {
    roomId: string;
}

export interface ISpeechTurnSwitchMessage extends IWSMessage<ISpeechTurnSwitchData> {
    type: EWSMessageType.SpeechTurnSwitch;
}

/**
 * CHAT_COMPLETE: Server → Client
 * Broadcast when both players have finished speaking
 */
export interface IChatCompleteData {
    roomId: string;
}

export interface IChatCompleteMessage extends IWSMessage<IChatCompleteData> {
    type: EWSMessageType.ChatComplete;
}

/**
 * VERDICT_RESULT: Server → Client
 * Broadcast when LLM verdict is ready
 */
export interface IVerdictResultData {
    roomId: string;
    verdict: IVerdictResult;
}

export interface IVerdictResultMessage extends IWSMessage<IVerdictResultData> {
    type: EWSMessageType.VerdictResult;
}

/**
 * VERDICT_FAILED: Server → Client
 * Broadcast when LLM verdict generation fails
 */
export interface IVerdictFailedData {
    roomId: string;
    error: string;
    canRetry: boolean;
    retryCount: number;
}

export interface IVerdictFailedMessage extends IWSMessage<IVerdictFailedData> {
    type: EWSMessageType.VerdictFailed;
}

/**
 * VERDICT_RETRY: Client → Server
 * Sent to retry verdict generation after failure
 */
export interface IVerdictRetryData {
    roomId: string;
    userId: string;
}

export interface IVerdictRetryMessage extends IWSMessage<IVerdictRetryData> {
    type: EWSMessageType.VerdictRetry;
}

/**
 * Frontend Verdict Result Format
 * This matches the expected format on the frontend
 */

/**
 * Third-party factor with emoji
 */
export interface IVerdictThirdPartyFactor {
    name: string;
    percentage: number;
    emoji: string;
}

/**
 * Dimension scores with English keys
 */
export interface IVerdictDimensionScores {
    mouthHard: number;
    oldAccountDigging: number;
    logicFallacy: number;
    coquettishDamage: number;
    survivalInstinct: number;
    victimActing: number;
}

/**
 * Responsibility distribution
 */
export interface IVerdictResponsibility {
    host: number;
    guest: number;
    thirdParty: {
        factors: IVerdictThirdPartyFactor[];
    };
}

/**
 * Radar chart data
 */
export interface IVerdictRadarChart {
    host: IVerdictDimensionScores;
    guest: IVerdictDimensionScores;
}

/**
 * Punishment task for loser
 */
export interface IVerdictPunishmentTask {
    role: 'host' | 'guest';
    task: string;
}

/**
 * Secret report for a player
 */
export interface IVerdictSecretReport {
    role: 'host' | 'guest';
    highestDimension: string;
    advice: string;
}

/**
 * Complete verdict result structure
 * This is the format sent to the frontend
 */
export interface IVerdictResult {
    /** Case number */
    caseNumber: string;
    /** Winner role */
    winnerId: 'host' | 'guest';
    /** Loser role */
    loserId: 'host' | 'guest';
    /** Responsibility distribution */
    responsibility: IVerdictResponsibility;
    /** Radar chart scores */
    radarChart: IVerdictRadarChart;
    /** Judge's verdict message */
    verdict: string;
    /** Punishment task for loser */
    punishmentTask: IVerdictPunishmentTask;
    /** Secret reports for both players */
    secretReports: IVerdictSecretReport[];
}

/**
 * Union type of all verdict messages
 */
export type TVerdictMessage =
    | ISpeechTurnEndMessage
    | ISpeechTurnSwitchMessage
    | IChatCompleteMessage
    | IVerdictResultMessage
    | IVerdictFailedMessage
    | IVerdictRetryMessage;
