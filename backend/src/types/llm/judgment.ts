/**
 * Judgment Verdict Types
 * Type definitions for the "清汤大老爷判决书" feature
 */

/**
 * A third-party comedic factor contributing to responsibility
 */
export interface IThirdPartyFactor {
    /** 搞笑因素名称 */
    name: string;
    /** 该因素占比 */
    percentage: number;
}

/**
 * Six-dimensional radar chart scores (0-100)
 */
export interface IRadarScores {
    嘴硬程度: number;
    翻旧账: number;
    逻辑滑坡: number;
    撒娇暴击: number;
    求生欲: number;
    受害者演技: number;
}

/**
 * Full judgment verdict response from the LLM
 */
export interface IJudgmentResponse {
    /** 案件编号 e.g. "NO.12345" */
    caseNumber: string;
    /** 责任分布 (player1 + player2 + factors = 100) */
    responsibility: {
        player1: number;
        player2: number;
        thirdParty: {
            factors: IThirdPartyFactor[];
        };
    };
    /** 六维战力雷达图 */
    radarChart: {
        player1: IRadarScores;
        player2: IRadarScores;
    };
    /** 大老爷赠言 */
    verdict: string;
    /** 惩罚任务：败诉方需要完成的任务 */
    punishmentTask: string;
}

/**
 * Create judgment request payload
 */
export interface ICreateJudgmentRequest {
    player1Speech: string;
    player2Speech: string;
    /** 幂等键，防止前端重复调用 OpenAI */
    idempotencyKey?: string;
}
