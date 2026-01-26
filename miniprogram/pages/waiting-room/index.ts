// pages/waiting-room/index.ts

import { roomService } from '../../services/room-service';
import { roomWebSocketService } from '../../services/room-websocket-service';
import { wsManager } from '../../services/websocket-manager';
import { drumService } from '../../services/drum-service';
import type { IUser } from '../../models/user';
import type { IRoom } from '../../models/room';
import { ERoomStatus } from '../../models/room';
import { EPlayerRole } from '../../types/websocket-common';

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
    // 按钮动画
    hostButtonAnimation: WechatMiniprogram.AnimationExportResult;
    joinButtonAnimation: WechatMiniprogram.AnimationExportResult;
    cancelButtonAnimation: WechatMiniprogram.AnimationExportResult;
    confirmButtonAnimation: WechatMiniprogram.AnimationExportResult;
    // 用户和房间信息
    currentUser: IUser | null;
    currentRoom: IRoom | null;
}

/**
 * 页面自定义选项
 */
interface IWaitingRoomCustomOption extends WechatMiniprogram.Page.CustomOption {
    waitingTextTimer: number | null;
    hostButtonAnim: WechatMiniprogram.Animation | null;
    joinButtonAnim: WechatMiniprogram.Animation | null;
    cancelButtonAnim: WechatMiniprogram.Animation | null;
    confirmButtonAnim: WechatMiniprogram.Animation | null;
    isCreatingRoom: boolean;
    isJoiningRoom: boolean;
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
        // 按钮动画
        hostButtonAnimation: {} as WechatMiniprogram.AnimationExportResult,
        joinButtonAnimation: {} as WechatMiniprogram.AnimationExportResult,
        cancelButtonAnimation: {} as WechatMiniprogram.AnimationExportResult,
        confirmButtonAnimation: {} as WechatMiniprogram.AnimationExportResult,
        // 用户和房间信息
        currentUser: null,
        currentRoom: null,
    },

    // 定时器引用
    waitingTextTimer: null,
    // 动画实例
    hostButtonAnim: null,
    joinButtonAnim: null,
    cancelButtonAnim: null,
    confirmButtonAnim: null,
    // 请求锁
    isCreatingRoom: false,
    isJoiningRoom: false,

    onLoad(): void {
        this.initAnimations();
        this.initWebSocket();
        this.initUser();
    },

    onShow(): void {
        // 页面显示时执行
    },

    onUnload(): void {
        this.clearAllTimers();
        // 断开 WebSocket 连接将由服务器处理用户离开
    },

    onHide(): void {
        this.clearAllTimers();
    },

    /**
     * 初始化 WebSocket 连接
     */
    initWebSocket(): void {
        wsManager.connect({
            onConnect: () => {
                console.log('[WaitingRoom] WebSocket connected');
            },
            onDisconnect: () => {
                console.log('[WaitingRoom] WebSocket disconnected');
                void wx.showToast({ title: '连接已断开', icon: 'error' });
            },
            onError: error => {
                console.error('[WaitingRoom] WebSocket error:', error);
                void wx.showToast({ title: '连接错误', icon: 'error' });
            },
        });

        roomWebSocketService.initialize((room: IRoom) => {
            this.handleRoomJoined(room);
        });
    },

    /**
     * 初始化用户信息
     */
    initUser(): void {
        const userId = wx.getStorageSync('userId') || this.generateUserId();
        const nickname = wx.getStorageSync('nickname') || '匿名用户';

        if (!wx.getStorageSync('userId')) {
            wx.setStorageSync('userId', userId);
            wx.setStorageSync('nickname', nickname);
        }

        this.setData({
            currentUser: { userId, nickname },
        });
    },

    /**
     * 生成用户 ID
     */
    generateUserId(): string {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        // 停止倒计时组件
        const countdownComponent = this.selectComponent('#countdown');
        if (countdownComponent) {
            countdownComponent.stop();
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

        setTimeout(() => {
            void this.createRoom();
        }, 200);
    },

    /**
     * 创建房间
     */
    async createRoom(): Promise<void> {
        // 防止重复请求
        if (this.isCreatingRoom) {
            console.warn('[WaitingRoom] Room creation already in progress');
            return;
        }

        const { currentUser } = this.data;
        if (!currentUser) {
            void wx.showToast({ title: '用户信息错误', icon: 'error' });
            return;
        }

        this.isCreatingRoom = true;
        void wx.showLoading({ title: '创建房间中...' });

        try {
            const room = await roomService.createRoom(currentUser);

            void wx.hideLoading();

            this.setData({
                currentRoom: room,
                roomCode: room.roomCode,
                viewMode: 'host_waiting',
                currentWaitingText: WAITING_TEXTS[0],
                waitingTextIndex: 0,
            });

            this.startWaitingTextCarousel();

            console.log(
                `[WaitingRoom] Room created - Code: ${room.roomCode}, Host: ${currentUser.userId}`
            );

            // CRITICAL: 房主创建房间后立即通过 WebSocket 加入
            // 后端已记录 hostUserId，前端通过该字段判断是否为房主
            roomWebSocketService.joinRoom(room.roomCode, currentUser);
        } catch (error) {
            void wx.hideLoading();
            console.error('[WaitingRoom] Create room failed:', error);
            void wx.showToast({
                title: error instanceof Error ? error.message : '创建房间失败',
                icon: 'error',
            });
        } finally {
            // 释放请求锁
            this.isCreatingRoom = false;
        }
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
        // 防止重复请求
        if (this.isJoiningRoom) {
            console.warn('[WaitingRoom] Join request already in progress');
            return;
        }

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

        const { currentUser } = this.data;
        if (!currentUser) {
            void wx.showToast({ title: '用户信息错误', icon: 'error' });
            return;
        }

        // 通过 WebSocket 加入房间
        this.setData({
            errorType: null,
            errorMessage: '',
        });

        this.isJoiningRoom = true;
        void wx.showLoading({ title: '加入房间中...' });

        // 发送加入房间消息
        roomWebSocketService.joinRoom(roomCodeInput, currentUser);

        // 设置超时处理
        setTimeout(() => {
            if (!this.data.currentRoom) {
                void wx.hideLoading();
                this.isJoiningRoom = false;
                this.setData({
                    errorType: 'not_found',
                    errorMessage: '加入超时，请重试',
                });
            }
        }, 5000);
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
     * 处理房间加入成功
     */
    handleRoomJoined(room: IRoom): void {
        console.log(room);
        void wx.hideLoading();

        // 释放加入房间的请求锁
        this.isJoiningRoom = false;

        this.setData({
            currentRoom: room,
            roomCode: room.roomCode,
        });

        // 如果是访客加入
        if (this.data.viewMode !== 'host_waiting') {
            this.onCloseModal();
            this.setData({
                viewMode: 'guest_waiting',
            });
        }

        // 检查房间是否已满员（2人）
        if (
            room.participants.length >= 2 &&
            room.status === ERoomStatus.Ready
        ) {
            // Start listening for drum messages BEFORE countdown
            // This queues DRUM_READY and DRUM_START messages
            drumService.startListening();

            // 启动倒计时，准备进入击鼓房间
            this.startCountdown();
        }
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
        }, 3000) as unknown as number;
    },

    /**
     * 启动倒计时
     */
    startCountdown(): void {
        const countdownComponent = this.selectComponent('#countdown');
        if (countdownComponent) {
            countdownComponent.start();
        }
    },

    /**
     * 倒计时完成回调
     */
    onCountdownComplete(): void {
        this.clearAllTimers();
        // 跳转到击鼓抢麦房间页面
        const { currentRoom, currentUser } = this.data;
        if (currentRoom && currentUser) {
            // Determine self role: host is Organizer, otherwise Joiner
            const isHost: boolean =
                currentRoom.hostUserId === currentUser.userId;
            const selfRole: EPlayerRole = isHost
                ? EPlayerRole.Organizer
                : EPlayerRole.Joiner;

            // Find organizer and joiner names
            const hostParticipant = currentRoom.participants.find(
                p => p.user.userId === currentRoom.hostUserId
            );
            const joinerParticipant = currentRoom.participants.find(
                p => p.user.userId !== currentRoom.hostUserId
            );

            const organizerName: string = encodeURIComponent(
                hostParticipant?.user.nickname || '小冤家'
            );
            const joinerName: string = encodeURIComponent(
                joinerParticipant?.user.nickname || '家冤小'
            );

            const url: string =
                `/pages/drum-room/index?roomId=${currentRoom.roomId}` +
                `&selfRole=${selfRole}` +
                `&hostRole=${EPlayerRole.Organizer}` +
                `&organizerName=${organizerName}` +
                `&joinerName=${joinerName}`;

            void wx.navigateTo({
                url,
                fail: err => {
                    console.error('跳转失败:', err);
                    void wx.showToast({
                        title: '跳转失败',
                        icon: 'error',
                    });
                },
            });
        }
    },

    /**
     * 阻止遮罩层事件穿透
     */
    preventTouchMove(): void {
        // 空函数，阻止事件穿透
    },
});
