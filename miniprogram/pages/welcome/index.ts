// pages/welcome/index.ts

interface WelcomePageData {
    avatarAnimation: WechatMiniprogram.AnimationExportResult;
}

Page<WelcomePageData, WechatMiniprogram.Page.CustomOption>({
    data: {
        avatarAnimation: {} as WechatMiniprogram.AnimationExportResult,
    },

    breathingTimer: null as number | null,
    isScaledUp: false,

    onLoad() {
        this.startBreathingAnimation();
    },

    onShow() {
        // Resume animation if needed
        if (!this.breathingTimer) {
            this.startBreathingAnimation();
        }
    },

    onHide() {
        this.stopBreathingAnimation();
    },

    onUnload() {
        this.stopBreathingAnimation();
    },

    startBreathingAnimation() {
        // Initial scale
        this.animateScale(1.3);

        // Toggle scale every 1.5s (half of 3s cycle)
        this.breathingTimer = setInterval(() => {
            this.isScaledUp = !this.isScaledUp;
            const targetScale = this.isScaledUp ? 1.3 : 1.0;
            this.animateScale(targetScale);
        }, 1500);
    },

    stopBreathingAnimation() {
        if (this.breathingTimer !== null) {
            clearInterval(this.breathingTimer as number);
            this.breathingTimer = null;
        }
    },

    animateScale(scale: number) {
        const animation = wx.createAnimation({
            duration: 1500,
            timingFunction: 'ease-in-out',
        });
        animation.scale(scale, scale).step();
        this.setData({
            avatarAnimation: animation.export(),
        });
    },

    handleStartJudge() {
        setTimeout(async () => {
            await wx.navigateTo({ url: '/pages/waiting-room/index' });
        }, 250);
    },

    handleSettings() {
        // TODO: Navigate to settings page
    },

    handleRules() {
        // TODO: Navigate to rules page or show rules popup
    },

    handleFeedback() {
        // TODO: Navigate to feedback page or open feedback channel
    },
});
