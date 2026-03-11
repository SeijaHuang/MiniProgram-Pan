// pages/welcome/index.ts
import { nicknameService } from '../../services/nickname-service';

interface WelcomePageData {
    // 入场动画状态
    titleAnimation: AnimationResult;
    taglineAnimation: AnimationResult;
    ctaAnimation: AnimationResult;
    // 控制初始隐藏状态
    isEntranceReady: boolean;
}

// 动画时序配置（毫秒）
const TIMING = {
    // 阶段 1：主标题
    TITLE_DELAY: 100,
    TITLE_DURATION: 1000,
    // 阶段 3：副标题 + slogan
    TAGLINE_DELAY: 900,
    TAGLINE_DURATION: 500,
    // 阶段 4：CTA 按钮
    CTA_DELAY: 1300,
    CTA_DURATION: 500,
} as const;

Page<WelcomePageData, WechatMiniprogram.Page.CustomOption>({
    data: {
        titleAnimation: {} as AnimationResult,
        taglineAnimation: {} as AnimationResult,
        ctaAnimation: {} as AnimationResult,
        isEntranceReady: false,
    },

    hasPlayedEntrance: false,

    onLoad(): void {
        // 初始化用户 ID
        nicknameService.getUserId();

        wx.request({
            url: 'https://panleme.fun/health',
            success: res => console.log('HTTP OK:', res.statusCode),
            fail: err => console.log('HTTP Failed:', err),
        });

        // 入场动画只播放一次
        if (!this.hasPlayedEntrance) {
            this.hasPlayedEntrance = true;
            this.playEntranceAnimation();
        }
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

        // 阶段 2：头像入场由 avatar 组件自行处理

        // 阶段 3：副标题 + slogan 入场（上滑 + 淡入）
        setTimeout(() => {
            this.animateTagline();
        }, TIMING.TAGLINE_DELAY);

        // 阶段 4：CTA 按钮入场（弹性缩放）
        setTimeout(() => {
            this.animateCTA();
        }, TIMING.CTA_DELAY);
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
     * 「我要申冤！」点击处理 → 直接跳转等待室（昵称在等待室处理）
     */
    handleStartJudge(): void {
        setTimeout(() => {
            void wx.navigateTo({
                url: '/packageA/pages/waiting-room/index',
            });
        }, 250);
    },
});
