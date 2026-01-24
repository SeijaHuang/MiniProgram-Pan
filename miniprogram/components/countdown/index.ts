/**
 * Countdown Component
 * 倒计时组件 - 全屏遮罩倒计时
 */

/**
 * 组件数据接口
 */
interface ICountdownData {
    visible: boolean;
    currentCount: number;
    animationData: WechatMiniprogram.AnimationExportResult | null;
}

/**
 * 组件方法接口
 */
interface ICountdownMethods {
    start: () => void;
    stop: () => void;
    _buildAnimation: (
        num: number
    ) => WechatMiniprogram.AnimationExportResult | null;
    _animateNumber: (num: number) => void;
    _triggerHapticFeedback: () => void;
    _clearTimer: () => void;
    preventTouchMove: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: (...args: any[]) => any;
}

/**
 * 组件私有状态
 */
interface ICountdownPrivate {
    _countdownTimer: ReturnType<typeof setInterval> | null;
    _animation: WechatMiniprogram.Animation | null;
}

Component<
    ICountdownData,
    {
        duration: WechatMiniprogram.Component.FullProperty<NumberConstructor>;
        subtext: WechatMiniprogram.Component.FullProperty<StringConstructor>;
    },
    ICountdownMethods,
    ICountdownPrivate
>({
    properties: {
        /** 倒计时时长（秒） */
        duration: {
            type: Number,
            value: 3,
        },
        /** 倒计时下方文字 */
        subtext: {
            type: String,
            value: '即将开庭',
        },
    },

    data: {
        visible: false,
        currentCount: 3,
        animationData: null,
    },

    lifetimes: {
        attached(): void {
            this._countdownTimer = null;
            this._animation = wx.createAnimation({
                duration: 300,
                timingFunction: 'ease-out',
            });
        },

        detached(): void {
            this._clearTimer();
        },
    },

    methods: {
        /**
         * 开始倒计时
         */
        start(): void {
            // 防止重复调用
            this._clearTimer();

            const duration: number = this.properties.duration;

            // 构建初始动画数据
            const animationData: WechatMiniprogram.AnimationExportResult | null =
                this._buildAnimation(duration);

            // 一次性设置所有数据，确保动画和显示同步
            this.setData({
                visible: true,
                currentCount: duration,
                animationData: animationData,
            });

            this._triggerHapticFeedback();

            let currentCount: number = duration;

            this._countdownTimer = setInterval(() => {
                currentCount--;

                if (currentCount <= 0) {
                    this._clearTimer();
                    this.setData({ visible: false });
                    this.triggerEvent('complete');
                } else {
                    // _animateNumber 内部会调用 setData 设置 currentCount 和 animationData
                    this._animateNumber(currentCount);
                    this._triggerHapticFeedback();
                }
            }, 1000);
        },

        /**
         * 停止倒计时
         */
        stop(): void {
            this._clearTimer();
            this.setData({ visible: false });
        },

        /**
         * 构建动画数据（不调用 setData）
         */
        _buildAnimation(
            _num: number
        ): WechatMiniprogram.AnimationExportResult | null {
            if (!this._animation) return null;

            // 从大到小的缩放动画效果（不使用 opacity 避免不可见问题）
            this._animation.scale(1.5, 1.5).step({ duration: 0 });
            this._animation.scale(1.0, 1.0).step({ duration: 300 });

            return this._animation.export();
        },

        /**
         * 数字缩放动画（同时更新数据）
         */
        _animateNumber(num: number): void {
            const animationData: WechatMiniprogram.AnimationExportResult | null =
                this._buildAnimation(num);

            this.setData({
                currentCount: num,
                animationData: animationData,
            });
        },

        /**
         * 触发震动反馈
         */
        _triggerHapticFeedback(): void {
            wx.vibrateShort({
                type: 'heavy',
                fail: (): void => {
                    // 震动失败时静默处理
                },
            });
        },

        /**
         * 清除定时器
         */
        _clearTimer(): void {
            if (this._countdownTimer !== null) {
                clearInterval(this._countdownTimer);
                this._countdownTimer = null;
            }
        },

        /**
         * 阻止事件穿透
         */
        preventTouchMove(): void {
            // 空函数，阻止事件穿透
        },
    },
});
