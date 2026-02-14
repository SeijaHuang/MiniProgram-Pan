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

import type { IJudgmentResponse, IRadarScores } from '../../types/llm';
import type {
    IVerdictResult,
    IVerdictDimensionScores,
    IVerdictThirdPartyFactor,
} from '../../types/websocket/verdict';
import type { IParticipant } from '../../models/entities/room';

/**
 * Mapping from Chinese dimension keys to English keys
 */
const DIMENSION_MAP: Record<string, keyof IVerdictDimensionScores> = {
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
const DIMENSION_ADVICE: Record<keyof IVerdictDimensionScores, string> = {
    mouthHard: '建议多倾听对方的观点，试着从对方角度思考问题',
    oldAccountDigging: '过去的事就让它过去吧，专注于当下和未来',
    logicFallacy: '加强逻辑思维训练，避免跳跃性推理',
    coquettishDamage: '适度撒娇是可爱，过度可能会适得其反',
    survivalInstinct: '真诚比求生欲更重要，勇敢表达真实想法',
    victimActing: '减少自怜情绪，积极寻找解决问题的方法',
};

export class VerdictMapperService {
    /**
     * Map IJudgmentResponse to IVerdictResult
     *
     * @param judgment - Backend judgment response from LLM
     * @param hostUserId - Host user ID (room creator)
     * @param participants - Room participants
     * @returns Frontend verdict result
     */
    mapJudgmentToVerdict(
        judgment: IJudgmentResponse,
        _hostUserId: string,
        _participants: IParticipant[]
    ): IVerdictResult {
        // 1. Map dimension scores
        const hostScores = this.mapDimensionScores(judgment.radarChart.player1);
        const guestScores = this.mapDimensionScores(
            judgment.radarChart.player2
        );

        // 2. Map third-party factors with emoji
        const thirdPartyFactors = this.mapThirdPartyFactors(
            judgment.responsibility.thirdParty.factors
        );

        // 3. Determine winner/loser (lower responsibility = winner)
        const hostResponsibility = judgment.responsibility.player1;
        const guestResponsibility = judgment.responsibility.player2;

        const hostWins = hostResponsibility < guestResponsibility;
        const winnerId = hostWins ? 'host' : 'guest';
        const loserId = hostWins ? 'guest' : 'host';

        // 4. Use LLM-generated punishment task
        const punishmentTask = {
            role: loserId as 'host' | 'guest',
            task: judgment.punishmentTask,
        };

        // 5. Generate secret reports
        const secretReports = [
            this.generateSecretReport('host', hostScores),
            this.generateSecretReport('guest', guestScores),
        ];

        // 6. Build verdict result
        return {
            caseNumber: judgment.caseNumber,
            winnerId: winnerId as 'host' | 'guest',
            loserId: loserId as 'host' | 'guest',
            responsibility: {
                host: hostResponsibility,
                guest: guestResponsibility,
                thirdParty: {
                    factors: thirdPartyFactors,
                },
            },
            radarChart: {
                host: hostScores,
                guest: guestScores,
            },
            verdict: judgment.verdict,
            punishmentTask,
            secretReports,
        };
    }

    /**
     * Map Chinese dimension keys to English keys
     */
    private mapDimensionScores(
        chineseScores: IRadarScores
    ): IVerdictDimensionScores {
        const result: Partial<IVerdictDimensionScores> = {};

        // Convert to record for dynamic access
        const scoresRecord = chineseScores as unknown as Record<string, number>;

        for (const [chineseKey, englishKey] of Object.entries(DIMENSION_MAP)) {
            const score = scoresRecord[chineseKey] ?? 0;
            result[englishKey] = score;
        }

        return result as IVerdictDimensionScores;
    }

    /**
     * Add emoji to third-party factors
     */
    private mapThirdPartyFactors(
        factors: Array<{ name: string; percentage: number }>
    ): IVerdictThirdPartyFactor[] {
        return factors.map((factor, index) => ({
            name: factor.name,
            percentage: factor.percentage,
            emoji: FACTOR_EMOJIS[index % FACTOR_EMOJIS.length],
        }));
    }

    /**
     * Generate secret report for a player
     */
    private generateSecretReport(
        role: 'host' | 'guest',
        scores: IVerdictDimensionScores
    ): IVerdictResult['secretReports'][0] {
        // Find highest dimension
        let highestDimension: keyof IVerdictDimensionScores = 'mouthHard';
        let highestScore = 0;

        for (const [dimension, score] of Object.entries(scores)) {
            const numericScore = typeof score === 'number' ? score : 0;
            if (numericScore > highestScore) {
                highestScore = numericScore;
                highestDimension = dimension as keyof IVerdictDimensionScores;
            }
        }

        // Get dimension name in Chinese
        const chineseName: string =
            Object.keys(DIMENSION_MAP).find(
                key => DIMENSION_MAP[key] === highestDimension
            ) ?? '嘴硬程度';

        // Get advice
        const advice = DIMENSION_ADVICE[highestDimension];

        return {
            role,
            highestDimension: chineseName,
            advice,
        };
    }
}

// Singleton instance
export const verdictMapperService = new VerdictMapperService();
