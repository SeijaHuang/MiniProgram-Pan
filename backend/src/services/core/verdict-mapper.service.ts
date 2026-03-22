/**
 * Verdict Mapper Service
 * Transforms backend IJudgmentResponse to frontend IVerdictResult format
 *
 * ARCHITECTURE: Core Business Service
 * - Maps Chinese dimension keys to English keys
 * - Determines winner/loser based on responsibility
 * - Generates punishment tasks and secret reports
 * - Adds emoji to third-party factors
 */

import type {
    IJudgmentResponse,
    IPlayerInfo,
    IRadarScores,
} from '../../types/llm';
import type { IVerdictResult } from '../../types/websocket/verdict';

/**
 * Mapping from Chinese dimension keys to English keys
 */
const DIMENSION_MAP: Record<
    string,
    keyof IVerdictResult['radarChart'][0]['scores']
> = {
    嘴硬程度: 'mouthHard',
    翻旧账: 'oldAccountDigging',
    逻辑滑坡: 'logicFallacy',
    撒娇暴击: 'coquettishDamage',
    求生欲: 'survivalInstinct',
    受害者演技: 'victimActing',
};

/**
 * Emoji pool for third-party factors (rotates through)
 */
const FACTOR_EMOJIS = ['🌍', '☁️', '⏰', '💼', '🏠', '👪', '🎮', '📱'];

/**
 * Dimension advice templates for secret reports
 */
const DIMENSION_ADVICE: Record<
    keyof IVerdictResult['radarChart'][0]['scores'],
    string
> = {
    mouthHard: '建议多倾听对方的观点，试着从对方角度思考问题',
    oldAccountDigging: '过去的事就让它过去吧，专注于当下和未来',
    logicFallacy: '加强逻辑思维训练，避免跳跃性推理',
    coquettishDamage: '适度撒娇是可爱，过度可能会适得其反',
    survivalInstinct: '真诚比求生欲更重要，勇敢表达真实想法',
    victimActing: '减少自怜情绪，积极寻找解决问题的方法',
};

type IDimensionScores = IVerdictResult['radarChart'][0]['scores'];

export class VerdictMapperService {
    /**
     * Map IJudgmentResponse to IVerdictResult
     *
     * @param judgment - Backend judgment response from LLM
     * @param player1 - Player info for LLM's "player1"
     * @param player2 - Player info for LLM's "player2"
     * @returns Frontend verdict result
     */
    mapJudgmentToVerdict(
        judgment: IJudgmentResponse,
        player1: IPlayerInfo,
        player2: IPlayerInfo
    ): IVerdictResult {
        // 1. Map dimension scores
        const p1Scores = this.mapDimensionScores(judgment.radarChart.player1);
        const p2Scores = this.mapDimensionScores(judgment.radarChart.player2);

        // 2. Determine winner/loser (lower responsibility = winner)
        const p1Responsibility = judgment.responsibility.player1;
        const p2Responsibility = judgment.responsibility.player2;
        const p1Wins = p1Responsibility < p2Responsibility;
        const winnerId = p1Wins ? player1.userId : player2.userId;
        const loserId = p1Wins ? player2.userId : player1.userId;
        const loserNickname = p1Wins ? player2.nickname : player1.nickname;

        // 3. Map third-party factors with emoji
        const thirdParty = judgment.responsibility.thirdParty.factors.map(
            (f, i) => ({
                reason: f.name,
                percentage: f.percentage,
                emoji: FACTOR_EMOJIS[i % FACTOR_EMOJIS.length],
            })
        );

        // 4. Replace 玩家1/玩家2 with actual nicknames in text fields
        const replaceNames = (text: string): string =>
            text
                .replace(/玩家1/gi, player1.nickname)
                .replace(/玩家2/gi, player2.nickname);

        return {
            caseNumber: judgment.caseNumber,
            winnerId,
            loserId,
            responsibility: {
                players: [
                    {
                        userId: player1.userId,
                        nickname: player1.nickname,
                        percentage: p1Responsibility,
                    },
                    {
                        userId: player2.userId,
                        nickname: player2.nickname,
                        percentage: p2Responsibility,
                    },
                ],
                thirdParty,
            },
            radarChart: [
                {
                    userId: player1.userId,
                    nickname: player1.nickname,
                    scores: p1Scores,
                },
                {
                    userId: player2.userId,
                    nickname: player2.nickname,
                    scores: p2Scores,
                },
            ],
            verdictSummary: replaceNames(judgment.verdict),
            punishmentTask: {
                loserUserId: loserId,
                loserNickname,
                task: replaceNames(judgment.punishmentTask),
                deadline: '',
            },
            secretReports: [
                this.generateSecretReport(player1.userId, p1Scores),
                this.generateSecretReport(player2.userId, p2Scores),
            ],
        };
    }

    /**
     * Map Chinese dimension keys to English keys
     */
    private mapDimensionScores(chineseScores: IRadarScores): IDimensionScores {
        const result: Partial<IDimensionScores> = {};
        const scoresRecord = chineseScores as unknown as Record<string, number>;
        for (const [chineseKey, englishKey] of Object.entries(DIMENSION_MAP)) {
            result[englishKey] = scoresRecord[chineseKey] ?? 0;
        }
        return result as IDimensionScores;
    }

    /**
     * Generate secret report for a player
     */
    private generateSecretReport(
        userId: string,
        scores: IDimensionScores
    ): IVerdictResult['secretReports'][0] {
        let highestDimension: keyof IDimensionScores = 'mouthHard';
        let highestScore = 0;

        for (const [dimension, score] of Object.entries(scores)) {
            const numericScore = typeof score === 'number' ? score : 0;
            if (numericScore > highestScore) {
                highestScore = numericScore;
                highestDimension = dimension as keyof IDimensionScores;
            }
        }

        const title: string =
            Object.keys(DIMENSION_MAP).find(
                key => DIMENSION_MAP[key] === highestDimension
            ) ?? '嘴硬程度';

        return {
            userId,
            title,
            advice: DIMENSION_ADVICE[highestDimension],
        };
    }
}

// Singleton instance
export const verdictMapperService = new VerdictMapperService();
