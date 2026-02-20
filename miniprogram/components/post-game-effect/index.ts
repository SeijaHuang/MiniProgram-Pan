// components/post-game-effect/index.ts

Component({
    properties: {
        visible: {
            type: Boolean,
            value: false,
        },
        type: {
            type: String,
            value: '',
        },
    },

    data: {
        stampAnim: {} as WechatMiniprogram.AnimationExportResult,
        begAnim: {} as WechatMiniprogram.AnimationExportResult,
    },

    observers: {
        'visible, type'(visible: boolean, type: string): void {
            if (visible && type) {
                // Delay to ensure wx:if has rendered the element
                setTimeout(() => {
                    if (type === 'stamp_death') {
                        this._playStamp();
                    } else if (type === 'beg_emoji') {
                        this._playBeg();
                    }
                }, 50);
            }
        },
    },

    methods: {
        /**
         * Play stamp ⚔️ effect: scale up + fade in, then settle
         */
        _playStamp(): void {
            wx.vibrateShort({
                type: 'heavy',
                fail: () => {
                    // Ignore vibration failure
                },
            });
            const anim: WechatMiniprogram.Animation = wx.createAnimation({
                duration: 200,
                timingFunction: 'ease-out',
            });
            anim.scale(1.2).opacity(1).step();
            this.setData({ stampAnim: anim.export() });

            // Settle: scale back to 1
            setTimeout(() => {
                const settle: WechatMiniprogram.Animation = wx.createAnimation({
                    duration: 100,
                    timingFunction: 'ease-in-out',
                });
                settle.scale(1).step();
                this.setData({ stampAnim: settle.export() });
            }, 200);
        },

        /**
         * Play beg 🧎 effect: slide up + fade in
         */
        _playBeg(): void {
            wx.vibrateShort({
                type: 'medium',
                fail: () => {
                    // Ignore vibration failure
                },
            });
            const anim: WechatMiniprogram.Animation = wx.createAnimation({
                duration: 400,
                timingFunction: 'ease-out',
            });
            anim.translateY(0).opacity(1).step();
            this.setData({ begAnim: anim.export() });
        },
    },
});
