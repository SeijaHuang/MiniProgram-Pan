// pages/waiting-room/index.ts

/**
 * 视图模式类型
 * - entry: 入口模式，显示两个主按钮
 * - host_waiting: 房主等待模式，显示房间号和等待文案
 * - guest_waiting: 访客等待模式，显示已加入提示
 */
type ViewMode = 'entry' | 'host_waiting' | 'guest_waiting';

/**
 * 错误类型
 */
type ErrorType = 'length' | 'not_found' | 'full' | 'started' | null;

/**
 * 页面数据接口
 */
interface IWaitingRoomPageData {
    viewMode: ViewMode;
    // 弹窗相关
    showJoinModal: boolean;
    roomCodeInput: string;
    roomCodeDisplay: string[];
    inputFocus: boolean;
    errorType: ErrorType;
    errorMessage: string;
    isJoinButtonDisabled: boolean;
    // 房主等待相关
    roomCode: string;
    waitingTextIndex: number;
    waitingTexts: string[];
    currentWaitingText: string;
    // 倒计时相关
    showCountdown: boolean;
    countdown: number;
    // 按钮动画
    hostButtonAnimation: WechatMiniprogram.AnimationExportResult;
    joinButtonAnimation: WechatMiniprogram.AnimationExportResult;
    cancelButtonAnimation: WechatMiniprogram.AnimationExportResult;
    confirmButtonAnimation: WechatMiniprogram.AnimationExportResult;
}

/**
 * 页面自定义选项
 */
interface IWaitingRoomCustomOption extends WechatMiniprogram.Page.CustomOption {
    waitingTextTimer: number | null;
    countdownTimer: number | null;
    mockGuestTimer: number | null;
    hostButtonAnim: WechatMiniprogram.Animation | null;
    joinButtonAnim: WechatMiniprogram.Animation | null;
    cancelButtonAnim: WechatMiniprogram.Animation | null;
    confirmButtonAnim: WechatMiniprogram.Animation | null;
}

/**
 * 错误信息映射
 */
const ERROR_MESSAGES: Record<Exclude<ErrorType, null>, string> = {
    length: '请输入完整的6位房间号',
    not_found: '房间不存在，请检查房间号',
    full: '房间已满，无法加入',
    started: '房间已开始，无法加入',
};

/**
 * 等待文案列表
 */
const WAITING_TEXTS: string[] = [
    '正在等待对方加入...',
    '冤家路窄，缘分天定...',
    '孽缘将至，请稍候...',
    '命中注定的相遇即将发生...',
    '等待你的"冤家"上线...',
];

const INITIAL_COUNTDOWN_TIME = 3;

/**
 * 生成6位随机房间号
 */
function generateRoomCode(): string {
    const chars = '0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

Page<IWaitingRoomPageData, IWaitingRoomCustomOption>({
    data: {
        viewMode: 'entry',
        // 弹窗相关
        showJoinModal: false,
        roomCodeInput: '',
        roomCodeDisplay: ['', '', '', '', '', ''],
        inputFocus: false,
        errorType: null,
        errorMessage: '',
        isJoinButtonDisabled: true,
        // 房主等待相关
        roomCode: '',
        waitingTextIndex: 0,
        waitingTexts: WAITING_TEXTS,
        currentWaitingText: WAITING_TEXTS[0],
        // 倒计时相关
        showCountdown: false,
        countdown: 3,
        // 按钮动画
        hostButtonAnimation: {} as WechatMiniprogram.AnimationExportResult,
        joinButtonAnimation: {} as WechatMiniprogram.AnimationExportResult,
        cancelButtonAnimation: {} as WechatMiniprogram.AnimationExportResult,
        confirmButtonAnimation: {} as WechatMiniprogram.AnimationExportResult,
    },

    // 定时器引用
    waitingTextTimer: null,
    countdownTimer: null,
    mockGuestTimer: null,
    // 动画实例
    hostButtonAnim: null,
    joinButtonAnim: null,
    cancelButtonAnim: null,
    confirmButtonAnim: null,

    onLoad(): void {
        this.initAnimations();
    },

    onShow(): void {
        // 页面显示时执行
    },

    onUnload(): void {
        this.clearAllTimers();
    },

    onHide(): void {
        this.clearAllTimers();
    },

    /**
     * 初始化动画实例
     */
    initAnimations(): void {
        this.hostButtonAnim = wx.createAnimation({
            duration: 100,
            timingFunction: 'ease-out',
        });
        this.joinButtonAnim = wx.createAnimation({
            duration: 100,
            timingFunction: 'ease-out',
        });
        this.cancelButtonAnim = wx.createAnimation({
            duration: 100,
            timingFunction: 'ease-out',
        });
        this.confirmButtonAnim = wx.createAnimation({
            duration: 100,
            timingFunction: 'ease-out',
        });
    },

    /**
     * 清除所有定时器
     */
    clearAllTimers(): void {
        if (this.waitingTextTimer) {
            clearInterval(this.waitingTextTimer);
            this.waitingTextTimer = null;
        }
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
        if (this.mockGuestTimer) {
            clearTimeout(this.mockGuestTimer);
            this.mockGuestTimer = null;
        }
    },

    /**
     * 播放按钮按下动画
     */
    playButtonPressAnimation(
        anim: WechatMiniprogram.Animation | null,
        animKey:
            | 'hostButtonAnimation'
            | 'joinButtonAnimation'
            | 'cancelButtonAnimation'
            | 'confirmButtonAnimation'
    ): void {
        if (!anim) return;

        // 按下效果：缩小 + 下移
        anim.scale(0.95, 0.95).translateY(6).step();
        this.setData({
            [animKey]: anim.export(),
        });

        // 150ms 后恢复
        setTimeout(() => {
            anim.scale(1, 1).translateY(0).step();
            this.setData({
                [animKey]: anim.export(),
            });
        }, 150);
    },

    /**
     * 触发震动反馈
     */
    triggerHapticFeedback(): void {
        wx.vibrateShort({
            type: 'medium',
            fail: () => {
                // 震动失败时静默处理（部分设备不支持）
            },
        });
    },

    /**
     * 播放点击音效（预留 hook）
     */
    playClickSound(): void {
        // TODO: 实现音效播放
        // 当前为预留接口，待音频资源就绪后实现
        // const innerAudioContext = wx.createInnerAudioContext();
        // innerAudioContext.src = '/assets/sounds/click.mp3';
        // innerAudioContext.play();
    },

    /**
     * 点击"发起申冤"按钮
     */
    onHostButtonTap(): void {
        this.triggerHapticFeedback();
        this.playClickSound();
        this.playButtonPressAnimation(
            this.hostButtonAnim,
            'hostButtonAnimation'
        );

        // 生成房间号并切换到房主等待模式
        const roomCode = generateRoomCode();

        setTimeout(() => {
            this.setData({
                viewMode: 'host_waiting',
                roomCode: roomCode,
                waitingTextIndex: 0,
                currentWaitingText: WAITING_TEXTS[0],
            });

            // 启动等待文案轮播
            this.startWaitingTextCarousel();
            // 启动模拟对方加入（5-10秒后）
            this.startMockGuestJoin();
        }, 200);
    },

    /**
     * 点击"加入房间"按钮
     */
    onJoinButtonTap(): void {
        this.triggerHapticFeedback();
        this.playClickSound();
        this.playButtonPressAnimation(
            this.joinButtonAnim,
            'joinButtonAnimation'
        );

        setTimeout(() => {
            this.setData({
                showJoinModal: true,
                roomCodeInput: '',
                roomCodeDisplay: ['', '', '', '', '', ''],
                inputFocus: true,
                errorType: null,
                errorMessage: '',
                isJoinButtonDisabled: true,
            });
        }, 200);
    },

    /**
     * 关闭加入房间弹窗
     */
    onCloseModal(): void {
        this.setData({
            showJoinModal: false,
            roomCodeInput: '',
            roomCodeDisplay: ['', '', '', '', '', ''],
            inputFocus: false,
            errorType: null,
            errorMessage: '',
        });
    },

    /**
     * 点击输入框区域，触发隐藏 input 聚焦
     */
    onCodeBoxesTap(): void {
        // 需要先设为 false 再设为 true，才能重新触发聚焦
        this.setData({ inputFocus: false }, () => {
            this.setData({ inputFocus: true });
        });
    },

    /**
     * 房间号输入变化
     */
    onRoomCodeInput(e: WechatMiniprogram.Input): void {
        const value = e.detail.value.replace(/\D/g, '').slice(0, 6);
        const display: string[] = [];

        for (let i = 0; i < 6; i++) {
            display.push(value[i] || '');
        }

        this.setData({
            roomCodeInput: value,
            roomCodeDisplay: display,
            isJoinButtonDisabled: value.length !== 6,
            errorType: null,
            errorMessage: '',
        });
    },

    /**
     * 确认加入房间
     */
    onConfirmJoin(): void {
        const { roomCodeInput } = this.data;

        this.triggerHapticFeedback();
        this.playClickSound();
        this.playButtonPressAnimation(
            this.confirmButtonAnim,
            'confirmButtonAnimation'
        );

        // 校验长度
        if (roomCodeInput.length !== 6) {
            this.setData({
                errorType: 'length',
                errorMessage: ERROR_MESSAGES.length,
            });
            return;
        }

        // Mock 验证逻辑
        // 模拟不同场景：
        // - 房间号以 0 开头：房间不存在
        // - 房间号以 9 开头：房间已满
        // - 房间号以 8 开头：房间已开始
        // - 其他：加入成功
        setTimeout(() => {
            if (roomCodeInput.startsWith('0')) {
                this.setData({
                    errorType: 'not_found',
                    errorMessage: ERROR_MESSAGES.not_found,
                });
                return;
            }

            if (roomCodeInput.startsWith('9')) {
                this.setData({
                    errorType: 'full',
                    errorMessage: ERROR_MESSAGES.full,
                });
                return;
            }

            if (roomCodeInput.startsWith('8')) {
                this.setData({
                    errorType: 'started',
                    errorMessage: ERROR_MESSAGES.started,
                });
                return;
            }

            // 加入成功
            this.setData({
                showJoinModal: false,
                inputFocus: false,
                viewMode: 'guest_waiting',
                roomCode: roomCodeInput,
            });

            // 模拟匹配成功，启动倒计时
            setTimeout(() => {
                this.startCountdown();
            }, 1500);
        }, 500);
    },

    /**
     * 取消审判（房主取消）
     */
    onCancelHost(): void {
        this.triggerHapticFeedback();
        this.playClickSound();
        this.playButtonPressAnimation(
            this.cancelButtonAnim,
            'cancelButtonAnimation'
        );

        this.clearAllTimers();

        setTimeout(() => {
            this.setData({
                viewMode: 'entry',
                roomCode: '',
                waitingTextIndex: 0,
                currentWaitingText: WAITING_TEXTS[0],
            });
        }, 200);
    },

    /**
     * 启动等待文案轮播
     */
    startWaitingTextCarousel(): void {
        if (this.waitingTextTimer) {
            clearInterval(this.waitingTextTimer);
        }

        this.waitingTextTimer = setInterval(() => {
            const nextIndex =
                (this.data.waitingTextIndex + 1) % WAITING_TEXTS.length;
            this.setData({
                waitingTextIndex: nextIndex,
                currentWaitingText: WAITING_TEXTS[nextIndex],
            });
        }, 3000);
    },

    /**
     * 启动模拟对方加入（Mock）
     */
    startMockGuestJoin(): void {
        // 5-10秒后模拟对方加入
        const delay = 10000 + Math.random() * 5000;

        this.mockGuestTimer = setTimeout(() => {
            if (this.data.viewMode === 'host_waiting') {
                this.clearAllTimers();
                this.startCountdown();
            }
        }, delay);
    },

    /**
     * 启动倒计时
     */
    startCountdown(): void {
        // 防止重复调用，先清除已有的倒计时定时器
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }

        this.setData({
            showCountdown: true,
            countdown: INITIAL_COUNTDOWN_TIME,
        });

        this.triggerHapticFeedback();

        let currentCount = INITIAL_COUNTDOWN_TIME;

        this.countdownTimer = setInterval(() => {
            currentCount -= 1;

            if (currentCount <= 0) {
                this.clearAllTimers();
                // 跳转到击鼓抢麦页面
                wx.navigateTo({
                    url: '/pages/chat-room/index',
                    fail: err => {
                        console.error('跳转失败:', err);
                        void wx.showToast({
                            title: '跳转失败',
                            icon: 'error',
                        });
                    },
                });
            } else {
                this.triggerHapticFeedback();
                this.setData({
                    countdown: currentCount,
                });
            }
        }, 1000);
    },

    /**
     * 阻止遮罩层事件穿透
     */
    preventTouchMove(): void {
        // 空函数，阻止事件穿透
    },
});
