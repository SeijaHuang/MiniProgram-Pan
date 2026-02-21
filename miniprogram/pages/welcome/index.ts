// pages/welcome/index.ts
import { nicknameService } from '../../services/nickname-service';

interface WelcomePageData {
    // 入场动画状态
    titleAnimation: AnimationResult;
    taglineAnimation: AnimationResult;
    ctaAnimation: AnimationResult;
    // 控制初始隐藏状态
    isEntranceReady: boolean;
    // 昵称弹窗
    showNicknameModal: boolean;
    nicknameInput: string;
    nicknameCharCount: number;
    isNicknameConfirmDisabled: boolean;
    nicknameModalAnimation: WechatMiniprogram.AnimationExportResult;
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
        // 昵称弹窗
        showNicknameModal: false,
        nicknameInput: '',
        nicknameCharCount: 0,
        isNicknameConfirmDisabled: true,
        nicknameModalAnimation: {} as WechatMiniprogram.AnimationExportResult,
    },

    hasPlayedEntrance: false,

    onLoad(): void {
        // 初始化用户 ID 和昵称
        nicknameService.getUserId();
        const storedNick: string = wx.getStorageSync('userNickName') || '';
        if (storedNick) {
            const app = getApp<IAppOption>();
            app.globalData.userInfo.nickName = storedNick;
        }

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
     * 「我要申冤！」点击处理
     * 有昵称 → 直接跳转；无昵称 → 弹出昵称设置弹窗
     */
    handleStartJudge(): void {
        const app = getApp<IAppOption>();
        const nickName: string = app.globalData.userInfo.nickName;

        if (nickName) {
            // 已有昵称，直接跳转
            setTimeout(() => {
                void wx.navigateTo({
                    url: '/packageA/pages/waiting-room/index',
                });
            }, 250);
        } else {
            // 无昵称，弹出昵称设置弹窗
            this.openNicknameModal();
        }
    },

    /**
     * 打开昵称弹窗并播放上滑动画
     */
    openNicknameModal(): void {
        this.setData({
            showNicknameModal: true,
            nicknameInput: '',
            nicknameCharCount: 0,
            isNicknameConfirmDisabled: true,
        });

        // 弹窗上滑入场动画
        const anim = wx.createAnimation({
            duration: 350,
            timingFunction: 'ease-out',
        });
        anim.translateY(0).step();
        this.setData({ nicknameModalAnimation: anim.export() });
    },

    /**
     * 昵称输入框变化
     */
    onNicknameInput(e: WechatMiniprogram.Input): void {
        const value: string = e.detail.value;
        this.setData({
            nicknameInput: value,
            nicknameCharCount: value.length,
            isNicknameConfirmDisabled: !nicknameService.validate(value),
        });
    },

    /**
     * 「击鼓申冤！」确认按钮
     */
    onNicknameConfirm(): void {
        const { nicknameInput } = this.data;
        if (!nicknameService.validate(nicknameInput)) {
            return;
        }

        nicknameService.saveNickName(nicknameInput);

        this.setData({ showNicknameModal: false });

        void wx.navigateTo({
            url: '/packageA/pages/waiting-room/index',
        });
    },

    /**
     * 「稍后再说」次级按钮
     * 使用默认值「申冤人」进入，不保存缓存
     */
    onNicknameSkip(): void {
        const app = getApp<IAppOption>();
        app.globalData.userInfo.nickName = '申冤人';

        this.setData({ showNicknameModal: false });

        void wx.navigateTo({
            url: '/packageA/pages/waiting-room/index',
        });
    },

    /**
     * 点击遮罩关闭弹窗（不保存）
     */
    onNicknameModalMaskTap(): void {
        this.setData({ showNicknameModal: false });
    },
});
