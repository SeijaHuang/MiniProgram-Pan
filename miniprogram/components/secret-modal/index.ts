// components/secret-modal/index.ts

type AnimationResult = WechatMiniprogram.AnimationExportResult;

/** Slide-in duration */
const SLIDE_DURATION: number = 400;

Component({
    properties: {
        visible: {
            type: Boolean,
            value: false,
        },
        title: {
            type: String,
            value: '',
        },
        advice: {
            type: String,
            value: '',
        },
        topDimension: {
            type: String,
            value: '',
        },
        topScore: {
            type: Number,
            value: 0,
        },
    },

    data: {
        panelAnimation: {} as AnimationResult,
    },

    observers: {
        visible(val: boolean): void {
            if (val) {
                this.slideIn();
            } else {
                this.slideOut();
            }
        },
    },

    methods: {
        /**
         * Slide panel in from bottom
         */
        slideIn(): void {
            // Start hidden
            const initAnim: WechatMiniprogram.Animation = wx.createAnimation({
                duration: 0,
            });
            initAnim.translateY(100 * 10).step();
            this.setData({ panelAnimation: initAnim.export() }, () => {
                // Animate to visible
                const anim: WechatMiniprogram.Animation = wx.createAnimation({
                    duration: SLIDE_DURATION,
                    timingFunction: 'ease-out',
                });
                anim.translateY(0).step();
                this.setData({
                    panelAnimation: anim.export(),
                });
            });
        },

        /**
         * Slide panel out to bottom
         */
        slideOut(): void {
            const anim: WechatMiniprogram.Animation = wx.createAnimation({
                duration: SLIDE_DURATION,
                timingFunction: 'ease-in',
            });
            anim.translateY(100 * 10).step();
            this.setData({ panelAnimation: anim.export() });
        },

        /**
         * Overlay tap → close
         */
        onOverlayTap(): void {
            this.triggerEvent('close');
        },

        /**
         * Close button tap
         */
        onCloseTap(): void {
            this.triggerEvent('close');
        },
    },
});
