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
    nextSpeakerUserId: string;
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
 * Complete verdict result structure
 * This is the format sent to the frontend
 */
export interface IVerdictResult {
    /** Case number */
    caseNumber: string;
    /** Winner's real userId */
    winnerId: string;
    /** Loser's real userId */
    loserId: string;
    /** Responsibility distribution */
    responsibility: {
        players: Array<{
            userId: string;
            nickname: string;
            percentage: number;
        }>;
        thirdParty: Array<{
            reason: string;
            percentage: number;
            emoji: string;
        }>;
    };
    /** Radar chart scores per player */
    radarChart: Array<{
        userId: string;
        nickname: string;
        scores: {
            mouthHard: number;
            oldAccountDigging: number;
            logicFallacy: number;
            coquettishDamage: number;
            survivalInstinct: number;
            victimActing: number;
        };
    }>;
    /** Judge's verdict message */
    verdictSummary: string;
    /** Punishment task for loser */
    punishmentTask: {
        loserUserId: string;
        loserNickname: string;
        task: string;
        deadline: string;
    };
    /** Secret reports for both players */
    secretReports: Array<{
        userId: string;
        title: string;
        advice: string;
    }>;
}

/**
 * LEAVE_ROOM: Client → Server
 * Sent when a player leaves the room from verdict page
 */
export interface ILeaveRoomData {
    roomId: string;
}

export interface ILeaveRoomMessage extends IWSMessage<ILeaveRoomData> {
    type: EWSMessageType.LeaveRoom;
}

/**
 * LEAVE_ROOM_ACK: Server → Client
 * Confirms room leave (sent to the leaving user)
 */
export interface ILeaveRoomAckData {
    roomId: string;
    allLeft: boolean;
}

export interface ILeaveRoomAckMessage extends IWSMessage<ILeaveRoomAckData> {
    type: EWSMessageType.LeaveRoomAck;
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
    | IVerdictRetryMessage
    | ILeaveRoomMessage
    | ILeaveRoomAckMessage;
