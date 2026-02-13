// components/post-game-effect/index.ts

type AnimationResult = WechatMiniprogram.AnimationExportResult;

/** Effect display duration (ms) */
const EFFECT_DURATION: number = 2000;
/** Animation in duration (ms) */
const ANIM_IN_DURATION: number = 500;

Component({
    properties: {
        effect: {
            type: String,
            value: '',
        },
    },

    data: {
        showEffect: false as boolean,
        effectType: '' as string,
        stampAnimation: {} as AnimationResult,
        begAnimation: {} as AnimationResult,
        _clearTimer: null as number | null,
    },

    observers: {
        effect(val: string): void {
            if (val === 'stamp_death' || val === 'beg_emoji') {
                this.playEffect(val);
            }
        },
    },

    lifetimes: {
        detached(): void {
            if (this.data._clearTimer !== null) {
                clearTimeout(this.data._clearTimer);
            }
        },
    },

    methods: {
        /**
         * Play the specified effect animation
         */
        playEffect(type: string): void {
            // Clear any existing effect
            if (this.data._clearTimer !== null) {
                clearTimeout(this.data._clearTimer);
            }

            this.setData(
                {
                    showEffect: true,
                    effectType: type,
                },
                () => {
                    if (type === 'stamp_death') {
                        this.playStamp();
                    } else if (type === 'beg_emoji') {
                        this.playBeg();
                    }
                }
            );

            // Auto-hide after duration
            this.data._clearTimer = setTimeout(() => {
                this.setData({
                    showEffect: false,
                    effectType: '',
                });
            }, EFFECT_DURATION) as unknown as number;
        },

        /**
         * Play stamp "卒" effect: scale(3→1) + fade in
         */
        playStamp(): void {
            // Initial state
            const initAnim: WechatMiniprogram.Animation = wx.createAnimation({
                duration: 0,
            });
            initAnim.scale(3, 3).opacity(0).step();
            this.setData({ stampAnimation: initAnim.export() }, () => {
                // Animate in
                const anim: WechatMiniprogram.Animation = wx.createAnimation({
                    duration: ANIM_IN_DURATION,
                    timingFunction: 'ease-out',
                });
                anim.scale(1, 1).opacity(1).step();
                this.setData({
                    stampAnimation: anim.export(),
                });
                // Vibrate
                wx.vibrateLong({
                    fail: () => {
                        // Ignore vibration failure
                    },
                });
            });
        },

        /**
         * Play beg emoji effect: float up + fade in
         */
        playBeg(): void {
            // Initial state
            const initAnim: WechatMiniprogram.Animation = wx.createAnimation({
                duration: 0,
            });
            initAnim.translateY(200).opacity(0).step();
            this.setData({ begAnimation: initAnim.export() }, () => {
                // Animate in
                const anim: WechatMiniprogram.Animation = wx.createAnimation({
                    duration: ANIM_IN_DURATION,
                    timingFunction: 'ease-out',
                });
                anim.translateY(0).opacity(1).step();
                this.setData({
                    begAnimation: anim.export(),
                });
                // Short vibrate
                wx.vibrateShort({
                    type: 'medium',
                    fail: () => {
                        // Ignore vibration failure
                    },
                });
            });
        },
    },
});
