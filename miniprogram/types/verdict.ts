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
 * Player responsibility entry
 */
export interface IResponsibilityPlayer {
    userId: string;
    nickname: string;
    percentage: number;
}

/**
 * Responsibility distribution (players + thirdParty = 100)
 */
export interface IResponsibility {
    players: IResponsibilityPlayer[];
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
 * Radar chart entry for one player
 */
export interface IRadarChartPlayer {
    userId: string;
    nickname: string;
    scores: IDimensionScores;
}

/**
 * Punishment task for the loser
 */
export interface IPunishmentTask {
    loserUserId: string;
    loserNickname: string;
    task: string;
    deadline: string;
}

/**
 * Secret report for one player
 */
export interface ISecretReport {
    userId: string;
    title: string;
    advice: string;
}

/**
 * Complete AI verdict result
 */
export interface IVerdictResult {
    caseNumber: string;
    winnerId: string | null;
    loserId: string | null;
    responsibility: IResponsibility;
    radarChart: IRadarChartPlayer[];
    verdictSummary: string;
    punishmentTask: IPunishmentTask;
    secretReports: ISecretReport[];
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
