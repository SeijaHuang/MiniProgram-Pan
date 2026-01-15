// pages/welcome/index.ts

type AnimationResult = WechatMiniprogram.AnimationExportResult;

interface WelcomePageData {
    // 入场动画状态
    titleAnimation: AnimationResult;
    avatarAnimation: AnimationResult;
    taglineAnimation: AnimationResult;
    ctaAnimation: AnimationResult;
    footerAnimation: AnimationResult;
    // 控制初始隐藏状态
    isEntranceReady: boolean;
}

// 动画时序配置（毫秒）
const TIMING = {
    // 阶段 1：主标题
    TITLE_DELAY: 100,
    TITLE_DURATION: 1000,
    // 阶段 2：头像
    AVATAR_DELAY: 400,
    AVATAR_DURATION: 600,
    // 阶段 3：副标题 + slogan
    TAGLINE_DELAY: 900,
    TAGLINE_DURATION: 500,
    // 阶段 4：CTA 按钮
    CTA_DELAY: 1300,
    CTA_DURATION: 500,
    // 阶段 5：底部导航
    FOOTER_DELAY: 1600,
    FOOTER_DURATION: 400,
    // 呼吸动画开始时间（头像入场完成后）
    BREATHING_START: 1200,
} as const;

Page<WelcomePageData, WechatMiniprogram.Page.CustomOption>({
    data: {
        titleAnimation: {} as AnimationResult,
        avatarAnimation: {} as AnimationResult,
        taglineAnimation: {} as AnimationResult,
        ctaAnimation: {} as AnimationResult,
        footerAnimation: {} as AnimationResult,
        isEntranceReady: false,
    },

    breathingTimer: null as number | null,
    isScaledUp: false,
    hasPlayedEntrance: false,

    onLoad(): void {
        // 入场动画只播放一次
        if (!this.hasPlayedEntrance) {
            this.hasPlayedEntrance = true;
            this.playEntranceAnimation();
        }
    },

    onShow(): void {
        // 如果入场动画已完成，恢复呼吸动画
        if (this.hasPlayedEntrance && !this.breathingTimer) {
            this.startBreathingAnimation();
        }
    },

    onHide(): void {
        this.stopBreathingAnimation();
    },

    onUnload(): void {
        this.stopBreathingAnimation();
    },

    /**
     * 播放完整入场动画序列
     * 按"导演式"节奏分阶段入场
     */
    playEntranceAnimation(): void {
        // 先标记准备状态，让元素进入初始隐藏位置
        this.setData({ isEntranceReady: true });

        // 阶段 1：主标题入场（旋转 + 缩放 + 弹性）
        setTimeout(() => {
            this.animateTitle();
        }, TIMING.TITLE_DELAY);

        // 阶段 2：头像入场（缩放 + 淡入）
        setTimeout(() => {
            this.animateAvatar();
        }, TIMING.AVATAR_DELAY);

        // 阶段 3：副标题 + slogan 入场（上滑 + 淡入）
        setTimeout(() => {
            this.animateTagline();
        }, TIMING.TAGLINE_DELAY);

        // 阶段 4：CTA 按钮入场（弹性缩放）
        setTimeout(() => {
            this.animateCTA();
        }, TIMING.CTA_DELAY);

        // 阶段 5：底部导航入场（淡入）
        setTimeout(() => {
            this.animateFooter();
        }, TIMING.FOOTER_DELAY);

        // 入场完成后开启呼吸动画
        setTimeout(() => {
            this.startBreathingAnimation();
        }, TIMING.BREATHING_START);
    },

    /**
     * 阶段 1：主标题动画
     * 效果：从 scale(0) + rotate(-180deg) 弹性过渡到正常状态
     */
    animateTitle(): void {
        const animation = wx.createAnimation({
            duration: TIMING.TITLE_DURATION,
            timingFunction: 'ease-out',
        });

        // 弹性效果：先放大到 1.1，再回弹到 1.0
        animation
            .scale(1.1, 1.1)
            .rotate(0)
            .opacity(1)
            .step({ duration: TIMING.TITLE_DURATION * 0.7 });

        animation.scale(1, 1).step({ duration: TIMING.TITLE_DURATION * 0.3 });

        this.setData({ titleAnimation: animation.export() });
    },

    /**
     * 阶段 2：头像动画
     * 效果：从 scale(0.6) + opacity(0) 平滑过渡到正常
     */
    animateAvatar(): void {
        const animation = wx.createAnimation({
            duration: TIMING.AVATAR_DURATION,
            timingFunction: 'ease-out',
        });

        animation.scale(1, 1).opacity(1).step();

        this.setData({ avatarAnimation: animation.export() });
    },

    /**
     * 阶段 3：副标题 + slogan 动画
     * 效果：从下方滑入 + 淡入
     */
    animateTagline(): void {
        const animation = wx.createAnimation({
            duration: TIMING.TAGLINE_DURATION,
            timingFunction: 'ease-out',
        });

        animation.translateY(0).opacity(1).step();

        this.setData({ taglineAnimation: animation.export() });
    },

    /**
     * 阶段 4：CTA 按钮动画
     * 效果：弹性缩放入场，有"落地感"
     */
    animateCTA(): void {
        const animation = wx.createAnimation({
            duration: TIMING.CTA_DURATION,
            timingFunction: 'ease-out',
        });

        // 弹性效果：先放大到 1.08，再回弹到 1.0
        animation
            .scale(1.08, 1.08)
            .opacity(1)
            .step({ duration: TIMING.CTA_DURATION * 0.6 });

        animation.scale(1, 1).step({ duration: TIMING.CTA_DURATION * 0.4 });

        this.setData({ ctaAnimation: animation.export() });
    },

    /**
     * 阶段 5：底部导航动画
     * 效果：简单淡入
     */
    animateFooter(): void {
        const animation = wx.createAnimation({
            duration: TIMING.FOOTER_DURATION,
            timingFunction: 'ease-out',
        });

        animation.opacity(1).step();

        this.setData({ footerAnimation: animation.export() });
    },

    /**
     * 呼吸动画：头像轻微上下浮动
     * 在入场动画完成后持续播放
     */
    startBreathingAnimation(): void {
        // 初始向上浮动
        this.animateBreathing(true);

        // 每 1.5 秒切换方向
        this.breathingTimer = setInterval(() => {
            this.isScaledUp = !this.isScaledUp;
            this.animateBreathing(this.isScaledUp);
        }, 1500);
    },

    stopBreathingAnimation(): void {
        if (this.breathingTimer !== null) {
            clearInterval(this.breathingTimer as number);
            this.breathingTimer = null;
        }
    },

    /**
     * 呼吸动画单帧
     * @param isUp - true 为向上浮动，false 为回到原位
     */
    animateBreathing(isUp: boolean): void {
        const animation = wx.createAnimation({
            duration: 1500,
            timingFunction: 'ease-in-out',
        });

        const translateY = isUp ? -10 : 0;
        const scale = isUp ? 1.02 : 1;

        animation.translateY(translateY).scale(scale, scale).step();

        this.setData({ avatarAnimation: animation.export() });
    },

    handleStartJudge(): void {
        setTimeout(async () => {
            await wx.navigateTo({ url: '/pages/waiting-room/index' });
        }, 250);
    },

    handleSettings(): void {
        // TODO: Navigate to settings page
    },

    handleRules(): void {
        // TODO: Navigate to rules page or show rules popup
    },

    handleFeedback(): void {
        // TODO: Navigate to feedback page or open feedback channel
    },
});
