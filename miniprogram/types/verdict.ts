/**
 * Verdict Types (Frontend)
 * Type definitions for the verdict page and related services
 */

/**
 * Third-party comedic factor
 */
export interface IThirdPartyFactor {
    reason: string;
    percentage: number;
    emoji: string;
}

/**
 * Responsibility distribution (host + guest + thirdParty = 100)
 */
export interface IResponsibility {
    host: number;
    guest: number;
    thirdParty: IThirdPartyFactor[];
}

/**
 * Six-dimension battle scores (0-100 each)
 */
export interface IDimensionScores {
    mouthHard: number;
    oldAccountDigging: number;
    logicSlippery: number;
    charmAttack: number;
    survivalInstinct: number;
    victimActing: number;
}

/**
 * Battle stats for both players
 */
export interface IBattleStats {
    host: IDimensionScores;
    guest: IDimensionScores;
}

/**
 * Punishment task for the loser
 */
export interface IPunishmentTask {
    loserId: 'host' | 'guest';
    task: string;
    deadline: string;
}

/**
 * Secret report for one player
 */
export interface ISecretReport {
    title: string;
    advice: string;
}

/**
 * Secret reports for both players
 */
export interface ISecretReports {
    host: ISecretReport;
    guest: ISecretReport;
}

/**
 * Complete AI verdict result
 */
export interface IVerdictResult {
    caseNumber: string;
    winnerId: 'host' | 'guest' | null;
    loserId: 'host' | 'guest' | null;
    responsibility: IResponsibility;
    battleStats: IBattleStats;
    verdictSummary: string;
    punishmentTask: IPunishmentTask;
    secretReports: ISecretReports;
}

/**
 * Dimension labels mapping (Chinese)
 */
export const DIMENSION_LABELS: Record<keyof IDimensionScores, string> = {
    mouthHard: '嘴硬程度',
    oldAccountDigging: '翻旧账',
    logicSlippery: '逻辑滑坡',
    charmAttack: '撒娇暴击',
    survivalInstinct: '求生欲',
    victimActing: '受害者演技',
};

/**
 * Dimension keys in display order (clockwise from top)
 */
export const DIMENSION_KEYS: (keyof IDimensionScores)[] = [
    'mouthHard',
    'oldAccountDigging',
    'logicSlippery',
    'charmAttack',
    'survivalInstinct',
    'victimActing',
];

/**
 * POST_GAME_EFFECT payload (received from server)
 */
export interface IPostGameEffectPayload {
    roomId: string;
    effect: 'stamp_death' | 'beg_emoji';
    fromUserId: string;
}

/**
 * LEAVE_TOGETHER_ACK payload (received from server)
 */
export interface ILeaveTogetherAckPayload {
    roomId: string;
    allReady: boolean;
}
