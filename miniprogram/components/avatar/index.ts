// components/avatar/index.ts

type AnimationResult = WechatMiniprogram.AnimationExportResult;

/** 动画时序配置（毫秒） */
const AVATAR_TIMING = {
    ENTRANCE_DURATION: 600,
    BREATHING_INTERVAL: 1500,
    BREATHING_SCALE_UP: 1.3,
    BREATHING_SCALE_DOWN: 1.0,
} as const;

Component({
    properties: {
        /** 头像图片 URL */
        src: {
            type: String,
            value: '',
        },
        /** 徽标 emoji */
        badge: {
            type: String,
            value: '👑',
        },
        /** 头像直径（rpx） */
        size: {
            type: Number,
            value: 220,
        },
        /** 触发入场动画 */
        playEntrance: {
            type: Boolean,
            value: false,
        },
        /** 入场延迟（ms） */
        entranceDelay: {
            type: Number,
            value: 0,
        },
        /** 是否启用呼吸动画 */
        breathing: {
            type: Boolean,
            value: true,
        },
    },

    data: {
        animationData: {} as AnimationResult,
        isInitial: false as boolean,
        /** 内部状态 — 不绑定到 WXML */
        _breathingTimer: null as number | null,
        _isScaledUp: false as boolean,
        _hasPlayed: false as boolean,
        _entranceTimer: null as number | null,
    },

    observers: {
        playEntrance(val: boolean): void {
            if (!val || this.data._hasPlayed) {
                return;
            }
            this.data._hasPlayed = true;
            this.setData({ isInitial: true });

            // 等待一帧让初始状态渲染，然后播放入场
            setTimeout(() => {
                this.runEntrance();
            }, this.data.entranceDelay);
        },
    },

    lifetimes: {
        attached(): void {
            // 如果挂载时 playEntrance 已经是 true
            if (this.data.playEntrance && !this.data._hasPlayed) {
                this.data._hasPlayed = true;
                this.setData({ isInitial: true });

                setTimeout(() => {
                    this.runEntrance();
                }, this.data.entranceDelay);
            }
        },

        detached(): void {
            this.stopBreathing();
            if (this.data._entranceTimer !== null) {
                clearTimeout(this.data._entranceTimer);
                this.data._entranceTimer = null;
            }
        },
    },

    pageLifetimes: {
        show(): void {
            // 页面重新展示时恢复呼吸动画
            if (
                this.data._hasPlayed &&
                this.data.breathing &&
                !this.data._breathingTimer
            ) {
                this.startBreathing();
            }
        },

        hide(): void {
            this.stopBreathing();
        },
    },

    methods: {
        /** 入场动画：scale(0.6)+opacity(0) → scale(1)+opacity(1) */
        runEntrance(): void {
            const animation: WechatMiniprogram.Animation = wx.createAnimation({
                duration: AVATAR_TIMING.ENTRANCE_DURATION,
                timingFunction: 'ease-out',
            });

            animation.scale(1, 1).opacity(1).step();

            this.setData({ animationData: animation.export() }, () => {
                // 入场完成后开启呼吸动画
                if (this.data.breathing) {
                    this.data._entranceTimer = setTimeout(() => {
                        this.startBreathing();
                    }, AVATAR_TIMING.ENTRANCE_DURATION) as unknown as number;
                }
            });
        },

        /** 开始呼吸动画 */
        startBreathing(): void {
            this.data._isScaledUp = true;
            this.animateBreathing(AVATAR_TIMING.BREATHING_SCALE_UP);

            this.data._breathingTimer = setInterval(() => {
                this.data._isScaledUp = !this.data._isScaledUp;
                const targetScale: number = this.data._isScaledUp
                    ? AVATAR_TIMING.BREATHING_SCALE_UP
                    : AVATAR_TIMING.BREATHING_SCALE_DOWN;
                this.animateBreathing(targetScale);
            }, AVATAR_TIMING.BREATHING_INTERVAL) as unknown as number;
        },

        /** 停止呼吸动画 */
        stopBreathing(): void {
            if (this.data._breathingTimer !== null) {
                clearInterval(this.data._breathingTimer);
                this.data._breathingTimer = null;
            }
        },

        /** 单步呼吸动画 */
        animateBreathing(scale: number): void {
            const animation: WechatMiniprogram.Animation = wx.createAnimation({
                duration: AVATAR_TIMING.BREATHING_INTERVAL,
                timingFunction: 'ease-in-out',
            });

            animation.scale(scale, scale).step();
            this.setData({
                animationData: animation.export(),
            });
        },
    },
});
