// components/notification/index.ts

export type AnimationResult = WechatMiniprogram.AnimationExportResult;

const FADE_DURATION: number = 300;

Component({
    properties: {
        isOpen: {
            type: Boolean,
            value: false,
        },
        title: {
            type: String,
            value: '',
        },
        content: {
            type: String,
            value: '',
        },
        statusText: {
            type: String,
            value: '',
        },
        buttonText: {
            type: String,
            value: '',
        },
        disabledAfterClick: {
            type: Boolean,
            value: false,
        },
    },

    data: {
        boxAnimation: {} as AnimationResult,
        buttonDisabled: false,
    },

    observers: {
        isOpen(val: boolean): void {
            if (val) {
                this.setData({ buttonDisabled: false });
                this.fadeIn();
            } else {
                this.fadeOut();
            }
        },
    },

    methods: {
        fadeIn(): void {
            const initAnim: WechatMiniprogram.Animation = wx.createAnimation({
                duration: 0,
            });
            initAnim.opacity(0).scale(0.9).step();
            this.setData({ boxAnimation: initAnim.export() }, () => {
                const anim: WechatMiniprogram.Animation = wx.createAnimation({
                    duration: FADE_DURATION,
                    timingFunction: 'ease-out',
                });
                anim.opacity(1).scale(1).step();
                this.setData({ boxAnimation: anim.export() });
            });
        },

        fadeOut(): void {
            const anim: WechatMiniprogram.Animation = wx.createAnimation({
                duration: FADE_DURATION,
                timingFunction: 'ease-in',
            });
            anim.opacity(0).scale(0.9).step();
            this.setData({ boxAnimation: anim.export() });
        },

        onCloseTap(): void {
            this.triggerEvent('close');
        },

        onButtonTap(): void {
            if (this.properties.disabledAfterClick) {
                this.setData({ buttonDisabled: true });
            }
            this.triggerEvent('buttonTap');
        },
    },
});
