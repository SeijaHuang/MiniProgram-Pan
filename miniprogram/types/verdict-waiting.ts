/**
 * Verdict Waiting Page Types
 * 判决等待页类型定义
 */

/** 浮动粒子数据 */
export interface IParticle {
    id: number;
    /** 水平位置百分比 0-100 */
    left: number;
    /** 粒子直径 px */
    size: number;
    /** 透明度 0-1 */
    opacity: number;
    /** 动画周期 秒 */
    duration: number;
    /** 动画延迟 秒 */
    delay: number;
}

/** 文案卡片中的单条文案 */
export interface ILoadingText {
    id: number;
    text: string;
}

/** VERDICT_READY 消息 payload */
export interface IVerdictReadyPayload {
    roomId: string;
    roomCode: string;
    /** 判决结果状态 */
    status: 'success' | 'failed';
}

/** 页面 data 类型 */
export interface IVerdictWaitingData {
    /** 房间 ID */
    roomId: string;
    /** 房间 code */
    roomCode: string;

    /** 当前可见的文案数组 */
    visibleTexts: ILoadingText[];
    /** 省略号动画文本 */
    dots: string;

    /** 粒子数组 */
    particles: IParticle[];

    /** AI 是否仍在分析 */
    isAnalyzing: boolean;
    /** 是否显示超时界面 */
    showTimeout: boolean;
    /** 是否显示"判决已出"最终文案 */
    showFinalText: boolean;

    /* ---- 动画数据（wx.createAnimation 导出） ---- */
    /** 标题呼吸动画 */
    titleAnimation: WechatMiniprogram.AnimationExportResult | null;
    /** 大老爷浮动动画 */
    duckFloatAnimation: WechatMiniprogram.AnimationExportResult | null;
    /** 大老爷摇摆动画 */
    duckWobbleAnimation: WechatMiniprogram.AnimationExportResult | null;
    /** 左侧狗 */
    dogLeftAnimation: WechatMiniprogram.AnimationExportResult | null;
    /** 右侧狗 */
    dogRightAnimation: WechatMiniprogram.AnimationExportResult | null;
    /** 碰撞特效 */
    collisionAnimation: WechatMiniprogram.AnimationExportResult | null;
    /** 屏幕震动 */
    shakeAnimation: WechatMiniprogram.AnimationExportResult | null;
    /** 文案卡片入场 */
    cardAnimation: WechatMiniprogram.AnimationExportResult | null;
    /** 齿轮旋转动画 */
    gearAnimation: WechatMiniprogram.AnimationExportResult | null;
    /** 每条文案的入场动画 */
    textAnimations: WechatMiniprogram.AnimationExportResult[];
    /** 粒子动画数组（每个粒子一个动画导出） */
    particleAnimations: WechatMiniprogram.AnimationExportResult[];
}
