/**
 * Chat Room Page - 对簿公堂 / 语音申冤页
 */

import { chatService } from '@/services/chat-service';
import type { IMessage } from '@/models/message';
import { EMessageType } from '@/models/message';
import { EWSErrorCode } from '@/types/websocket-common';

type Phase = 'SPEAKER_A' | 'SPEAKER_B' | 'DONE';
type Role = 'A' | 'B';

interface IDisplayMessage {
    id: number;
    role: Role;
    content: string;
    timestamp: number;
}

interface IReaction {
    id: number;
    emoji: string;
    lane: number; // 0, 1, 2 三条轨道
    timeoutId: number;
}

interface IChatRoomPageData {
    // 房间标识
    roomCode: string;

    // 核心状态机字段
    phase: Phase;
    localRole: Role;
    remaining: number;
    totalPerTurn: number;

    // 派生权限
    canSpeak: boolean;
    canReact: boolean;

    // 倒计时状态
    countdownClass: 'normal' | 'warn' | 'danger';

    // 录音状态
    isRecording: boolean;

    // 消息列表（语音转文字）
    messages: IDisplayMessage[];

    // 表情系统
    reactions: IReaction[];
    emojiList: string[];
}

interface IChatRoomCustomOption extends WechatMiniprogram.Page.CustomOption {
    timerId: number | null;
    recorderManager: WechatMiniprogram.RecorderManager | null;
    reactionIdCounter: number;
    reactionTimeouts: number[];
    messageIdCounter: number;
}

const EMOJI_LIST = [
    '😠',
    '😢',
    '❤️',
    '🤔',
    '😂',
    '😅',
    '🥺',
    '💔',
    '👍',
    '👎',
    '🙄',
    '😤',
    '🤯',
    '😭',
];
const MAX_REACTIONS = 3;
const REACTION_DURATION_MIN = 3000;
const REACTION_DURATION_MAX = 5000;
const TOTAL_PER_TURN = 20;
const PHASE_TRANSITION: Record<Phase, Phase> = {
    SPEAKER_A: 'SPEAKER_B',
    SPEAKER_B: 'DONE',
    DONE: 'DONE',
};
const REACTION_LANES = [0, 1, 2];

Page<IChatRoomPageData, IChatRoomCustomOption>({
    data: {
        roomCode: '',

        phase: 'SPEAKER_A',
        localRole: 'A',
        remaining: TOTAL_PER_TURN,
        totalPerTurn: TOTAL_PER_TURN,

        canSpeak: true,
        canReact: false,

        countdownClass: 'normal',

        isRecording: false,

        messages: [],

        reactions: [],
        emojiList: EMOJI_LIST,
    },

    timerId: null,
    recorderManager: null,
    reactionIdCounter: 0,
    reactionTimeouts: [],
    messageIdCounter: 0,

    onLoad(options): void {
        // 解析页面参数
        const roomCode = options.roomCode ?? '';
        const localRole: Role = options.role === 'B' ? 'B' : 'A';

        // 校验 roomCode
        if (!roomCode) {
            void wx.showToast({ title: '房间号无效', icon: 'error' });
            setTimeout(() => {
                void wx.navigateBack();
            }, 1500);
            return;
        }

        // 计算初始权限
        const canSpeak: boolean = this.computeCanSpeak('SPEAKER_A', localRole);
        const canReact: boolean = !canSpeak;

        this.setData({
            roomCode,
            localRole,
            totalPerTurn: TOTAL_PER_TURN,
            remaining: TOTAL_PER_TURN,
            phase: 'SPEAKER_A',
            canSpeak,
            canReact,
            countdownClass: this.getCountdownClass(TOTAL_PER_TURN),
        });

        // 初始化聊天服务
        this.initChatService();

        // 初始化录音管理器
        this.initRecorderManager();

        // 启动倒计时
        this.startTimer();
    },

    onShow(): void {
        // 如果定时器不存在且不是 DONE 状态，重新启动
        if (!this.timerId && this.data.phase !== 'DONE') {
            this.startTimer();
        }
    },

    onHide(): void {
        this.cleanup();
    },

    onUnload(): void {
        this.cleanup();
    },

    /**
     * 清理资源
     */
    cleanup(): void {
        // 清理主定时器
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }

        // 停止录音
        if (this.recorderManager && this.data.isRecording) {
            this.recorderManager.stop();
        }

        // 清理所有表情 timeout
        if (this.reactionTimeouts.length) {
            this.reactionTimeouts.forEach(id => {
                clearTimeout(id);
            });
            this.reactionTimeouts = [];
        }
    },

    /**
     * 计算 canSpeak 权限
     */
    computeCanSpeak(phase: Phase, localRole: Role): boolean {
        if (phase === 'SPEAKER_A') {
            return localRole === 'A';
        }
        if (phase === 'SPEAKER_B') {
            return localRole === 'B';
        }
        return false;
    },

    /**
     * 获取倒计时 class
     */
    getCountdownClass(remaining: number): 'normal' | 'warn' | 'danger' {
        if (remaining <= 10) {
            return 'danger';
        }
        if (remaining <= 30) {
            return 'warn';
        }
        return 'normal';
    },

    /**
     * 初始化聊天服务
     */
    initChatService(): void {
        chatService.initialize(
            (message: IMessage) => {
                this.handleMessageReceived(message);
            },
            (code: EWSErrorCode, errorMessage: string) => {
                console.error('[ChatRoom] Chat error:', code, errorMessage);
                void wx.showToast({ title: errorMessage, icon: 'error' });
            }
        );
    },

    /**
     * 处理接收到的消息
     */
    handleMessageReceived(message: IMessage): void {
        const { localRole } = this.data;
        const displayMessage: IDisplayMessage = {
            id: this.messageIdCounter++,
            role:
                message.sender.userId === wx.getStorageSync('userId')
                    ? localRole
                    : localRole === 'A'
                      ? 'B'
                      : 'A',
            content:
                message.type === EMessageType.Text &&
                message.content.type === EMessageType.Text
                    ? message.content.text
                    : '[语音消息]',
            timestamp: message.createdAt,
        };

        this.setData({
            messages: [...this.data.messages, displayMessage],
        });
    },

    /**
     * 初始化录音管理器
     */
    initRecorderManager(): void {
        this.recorderManager = wx.getRecorderManager();

        this.recorderManager.onStart(() => {
            this.setData({ isRecording: true });
        });

        this.recorderManager.onStop(() => {
            this.setData({ isRecording: false });
            // TODO: 后续对接 WebSocket，发送录音文件
        });

        this.recorderManager.onError(err => {
            console.error('[ChatRoom] Recording error', err);
            this.setData({ isRecording: false });
            void wx.showToast({ title: '录音出错', icon: 'error' });
        });
    },

    /**
     * 启动倒计时定时器
     */
    startTimer(): void {
        if (this.timerId) {
            clearInterval(this.timerId);
        }

        this.timerId = setInterval(() => {
            this.tick();
        }, 1000) as unknown as number;
    },

    /**
     * 每秒 tick
     */
    tick(): void {
        const { remaining } = this.data;

        // ≤10 秒震动
        if (remaining <= 10 && remaining > 0) {
            void wx.vibrateShort({ type: 'medium' });
        }

        if (remaining <= 1) {
            // 时间到，切换阶段
            this.switchPhase();
        } else {
            // 更新剩余时间
            const newRemaining = remaining - 1;
            this.setData({
                remaining: newRemaining,
                countdownClass: this.getCountdownClass(newRemaining),
            });
        }
    },

    /**
     * 切换阶段
     */
    switchPhase(): void {
        const { phase, localRole, totalPerTurn } = this.data;

        // 强制停止录音
        if (this.recorderManager && this.data.isRecording) {
            this.recorderManager.stop();
        }

        const nextPhase: Phase = PHASE_TRANSITION[phase];

        if (nextPhase === 'DONE') {
            // 清理定时器
            if (this.timerId) {
                clearInterval(this.timerId);
                this.timerId = null;
            }

            this.setData({
                phase: 'DONE',
                canSpeak: false,
                canReact: false,
                remaining: 0,
            });
            return;

            // TODO: 跳转到分析页面
        } else {
            // 切换到下一阶段
            const canSpeak = this.computeCanSpeak(nextPhase, localRole);
            const canReact = !canSpeak;

            this.setData({
                phase: nextPhase,
                remaining: totalPerTurn,
                canSpeak,
                canReact,
                countdownClass: this.getCountdownClass(totalPerTurn),
                isRecording: false,
            });
        }
    },

    /**
     * 麦克风按下
     */
    onMicTouchStart(): void {
        if (!this.data.canSpeak) {
            return;
        }

        void wx.vibrateShort({ type: 'light' });
        this.startRecording();
    },

    /**
     * 麦克风松开
     */
    onMicTouchEnd(): void {
        this.stopRecording();
    },

    /**
     * 麦克风触摸取消
     */
    onMicTouchCancel(): void {
        this.stopRecording();
    },

    /**
     * 开始录音
     */
    startRecording(): void {
        if (!this.recorderManager || !this.data.canSpeak) {
            return;
        }

        wx.authorize({
            scope: 'scope.record',
            success: () => {
                this.recorderManager?.start({
                    duration: 60000,
                    sampleRate: 16000,
                    numberOfChannels: 1,
                    encodeBitRate: 48000,
                    format: 'mp3',
                });
            },
            fail: () => {
                void wx.showModal({
                    title: '需要录音权限',
                    content: '请在设置中开启录音权限',
                    confirmText: '去设置',
                    success: res => {
                        if (res.confirm) {
                            void wx.openSetting();
                        }
                    },
                });
            },
        });
    },

    /**
     * 停止录音
     */
    stopRecording(): void {
        if (this.recorderManager && this.data.isRecording) {
            this.recorderManager.stop();

            // TODO: 后续实现语音上传和识别
            // 当前仅支持文字消息
            void wx.showToast({
                title: '语音功能开发中',
                icon: 'none',
                duration: 1500,
            });
        }
    },

    /**
     * 发送表情
     */
    onEmojiTap(e: WechatMiniprogram.TouchEvent): void {
        if (!this.data.canReact) {
            return;
        }

        const emoji = e.currentTarget.dataset.emoji as string;
        if (!emoji) {
            return;
        }

        // 同屏最多 3 个表情
        if (this.data.reactions.length >= MAX_REACTIONS) {
            return;
        }

        void wx.vibrateShort({ type: 'light' });

        // 分配轨道
        const usedLanes = this.data.reactions.map(r => r.lane);
        const availableLanes = REACTION_LANES.filter(
            lane => !usedLanes.includes(lane)
        );

        if (!availableLanes.length) return;

        const lane =
            availableLanes[Math.floor(Math.random() * availableLanes.length)];

        const id = ++this.reactionIdCounter;

        // 3-5 秒后自动消失
        const duration =
            REACTION_DURATION_MIN +
            Math.random() * (REACTION_DURATION_MAX - REACTION_DURATION_MIN);

        const timeoutId = setTimeout(() => {
            this.removeReaction(id);
        }, duration) as unknown as number;

        this.reactionTimeouts.push(timeoutId);

        const newReaction: IReaction = {
            id,
            emoji,
            lane,
            timeoutId,
        };

        this.setData({
            reactions: [...this.data.reactions, newReaction],
        });

        // TODO: 后续对接 WebSocket，发送表情给对方
    },

    /**
     * 移除表情
     */
    removeReaction(id: number): void {
        const reactions = this.data.reactions.filter(r => r.id !== id);
        this.setData({ reactions });

        // 从 timeout 列表中移除
        const reaction = this.data.reactions.find(r => r.id === id);
        if (reaction) {
            const idx = this.reactionTimeouts.indexOf(reaction.timeoutId);
            if (idx > -1) {
                clearTimeout(id);
                this.reactionTimeouts.splice(idx, 1);
            }
        }
    },

    /**
     * 格式化时间
     */
    formatTime(seconds: number): string {
        const mins: number = Math.floor(seconds / 60);
        const secs: number = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * 添加消息到对话列表
     * @param role 发送者角色
     * @param content 语音转文字内容
     */
    addMessage(role: Role, content: string): void {
        const id: number = ++this.messageIdCounter;
        const timestamp: number = Date.now();

        const newMessage: IDisplayMessage = {
            id,
            role,
            content,
            timestamp,
        };

        this.setData({
            messages: [...this.data.messages, newMessage],
        });

        // 发送到服务器
        if (role === this.data.localRole) {
            chatService.sendTextMessage(content);
        }
    },
});
