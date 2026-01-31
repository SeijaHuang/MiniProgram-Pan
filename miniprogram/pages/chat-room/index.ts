/**
 * Chat Room Page - 对簿公堂 / 语音申冤页
 */

import { chatService } from '../../services/chat-service';
import type { IMessage } from '../../models/message';
import { EMessageType } from '../../models/message';
import { EWSErrorCode } from '../../types/websocket-common';

// 引入腾讯云语音识别插件
const QCloudAIVoicePlugin = requirePlugin('QCloudAIVoice');
type AsrManager = ReturnType<
    typeof QCloudAIVoicePlugin.speechRecognizerManager
>;

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

    // 语音识别相关
    speechTextLive: string; // 实时识别文本（Partial）
    speechTextFinal: string; // 最终识别文本（Final）
    isRecognizing: boolean; // 是否识别中
    recognizeError: string | null; // 识别错误信息
}

interface IChatRoomCustomOption extends WechatMiniprogram.Page.CustomOption {
    timerId: number | null;
    recorderManager: WechatMiniprogram.RecorderManager | null;
    reactionIdCounter: number;
    reactionTimeouts: number[];
    messageIdCounter: number;
    asrManager: AsrManager; // 语音识别管理器
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

/**
 * ASR 语音识别配置
 * 注意：生产环境中 SECRET_ID 和 SECRET_KEY 应通过后端接口获取，避免暴露在前端代码中
 */
const ASR_CONFIG = {
    SECRET_ID: '', // TODO: 从后端获取或使用环境变量
    SECRET_KEY: '', // TODO: 从后端获取或使用环境变量
    ENGINE_MODEL_TYPE: '16k_zh', // 16k 中文普通话通用模型
    VOICE_FORMAT: 1, // 1: PCM, 4: speex(sp)压缩, 6: silk, 8: mp3
} as const;

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

        // 语音识别相关
        speechTextLive: '',
        speechTextFinal: '',
        isRecognizing: false,
        recognizeError: null,
    },

    timerId: null,
    recorderManager: null,
    reactionIdCounter: 0,
    reactionTimeouts: [],
    messageIdCounter: 0,
    asrManager: null,

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

        // 初始化语音识别管理器（需要在录音管理器之后初始化）
        this.initAsrManager();

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
     * 初始化语音识别管理器
     * 获取 QCloudAIVoice 插件的语音识别管理器实例并注册回调
     * 注意：配置参数（secretId、secretKey 等）在调用 start() 时传入
     */
    initAsrManager(): void {
        try {
            // 获取语音识别管理器实例
            this.asrManager = QCloudAIVoicePlugin.speechRecognizerManager();

            // 注册回调函数
            this.initAsrCallbacks();

            console.log('[ChatRoom] ASR manager initialized');
        } catch (err) {
            console.error('[ChatRoom] Failed to initialize ASR manager:', err);
            this.setData({
                recognizeError: '语音识别初始化失败',
            });
            void wx.showToast({
                title: '语音识别初始化失败',
                icon: 'error',
            });
        }
    },

    /**
     * 初始化语音识别回调函数
     * 注册 QCloudAIVoice 插件提供的所有回调方法
     * 包括：开始识别、一句话开始/结束、识别结果变化、识别完成、错误、录音结束
     */
    initAsrCallbacks(): void {
        // 空值检查：确保 asrManager 已初始化
        if (!this.asrManager) {
            console.error('[ASR] Cannot init callbacks: asrManager is null');
            return;
        }

        // 类型断言，用于访问插件方法
        const manager = this.asrManager;
        /**
         * 1. 开始识别回调 (OnRecognitionStart)
         * 当语音识别开始时触发
         */
        manager.OnRecognitionStart((res: unknown) => {
            console.log('[ASR] 开始识别', res);
            this.setData({
                isRecognizing: true,
                recognizeError: null,
            });
        });

        /**
         * 2. 一句话开始回调 (OnSentenceBegin)
         * 当检测到一句话开始时触发
         */
        manager.OnSentenceBegin((res: unknown) => {
            console.log('[ASR] 一句话开始', res);
        });

        /**
         * 3. 识别结果变化回调 (OnRecognitionResultChange)
         * 实时返回识别中的文本（Partial 结果）
         */
        manager.OnRecognitionResultChange((res: unknown) => {
            console.log('[ASR] 识别结果变化', res);

            // 类型检查并提取文本
            const result = res as {
                result?: { voice_text_str?: string };
            } | null;

            if (result?.result?.voice_text_str) {
                this.setData({
                    speechTextLive: result.result.voice_text_str,
                });
            }
        });

        /**
         * 4. 一句话结束回调 (OnSentenceEnd)
         * 当一句话识别完成时触发，将结果固化
         */
        manager.OnSentenceEnd((res: unknown) => {
            console.log('[ASR] 一句话结束', res);

            // 类型检查并提取文本
            const result = res as {
                result?: { voice_text_str?: string };
            } | null;

            if (result?.result?.voice_text_str) {
                this.setData({
                    speechTextFinal: result.result.voice_text_str,
                });
            }
        });

        /**
         * 5. 识别完成回调 (OnRecognitionComplete)
         * 当整个语音识别流程完成时触发
         */
        manager.OnRecognitionComplete((res: unknown) => {
            console.log('[ASR] 识别完成', res);

            // 类型检查并提取文本
            const result = res as {
                result?: { voice_text_str?: string };
            } | null;

            if (result?.result?.voice_text_str) {
                this.setData({
                    speechTextFinal: result.result.voice_text_str,
                    speechTextLive: result.result.voice_text_str,
                    isRecognizing: false,
                });
            } else {
                this.setData({
                    isRecognizing: false,
                });
            }
        });

        /**
         * 6. 识别错误回调 (OnError)
         * 当语音识别过程中发生错误时触发
         */
        manager.OnError((error: unknown) => {
            console.error('[ASR] OnError callback:', error);

            // 提取错误信息字符串
            let errorMessage: string = '语音识别失败';
            if (error && typeof error === 'object') {
                const errorObj = error as { message?: string; errMsg?: string };
                if (errorObj.message) {
                    errorMessage = errorObj.message;
                } else if (errorObj.errMsg) {
                    errorMessage = errorObj.errMsg;
                }
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            this.handleRecognizeError(errorMessage);
        });

        /**
         * 7. 录音结束回调 (OnRecorderStop)
         * 当录音停止时触发，返回录音文件的临时路径
         */
        manager.OnRecorderStop((res: unknown) => {
            console.log('[ASR] 录音结束', res);

            // 类型检查
            const result = res as {
                tempFilePath?: string;
            } | null;

            if (result?.tempFilePath) {
                console.log('[ASR] 录音文件路径:', result.tempFilePath);
                // TODO: 如需上传录音文件，可在此处理
            }
        });

        console.log('[ASR] All callbacks registered');
    },

    /**
     * 处理语音识别错误
     * 更新错误状态、重置识别状态并显示 Toast 提示
     * @param errorMessage 错误信息字符串
     */
    handleRecognizeError(errorMessage: string): void {
        // 1. 记录错误日志
        console.error('[ASR] 识别错误', errorMessage);

        // 2. 更新状态
        this.setData({
            recognizeError: errorMessage,
            isRecognizing: false,
            speechTextLive: '',
        });

        // 3. 显示 Toast 提示
        void wx.showToast({
            title: '语音识别失败',
            icon: 'error',
            duration: 2000,
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
     * 开始录音和语音识别
     * 使用 QCloudAIVoice 插件的 start 方法，同时启动录音和识别
     */
    startRecording(): void {
        // 检查权限和 ASR 管理器
        if (!this.data.canSpeak) {
            return;
        }

        if (!this.asrManager) {
            console.error('[ASR] asrManager is not initialized');
            void wx.showToast({
                title: '语音识别未初始化',
                icon: 'error',
            });
            return;
        }

        // 清空识别状态
        this.setData({
            speechTextLive: '',
            speechTextFinal: '',
            recognizeError: null,
            isRecognizing: false,
        });

        wx.authorize({
            scope: 'scope.record',
            success: () => {
                // 使用 ASR 插件的 start 方法（同时启动录音和识别）
                if (this.asrManager) {
                    this.asrManager.start({
                        secretId: ASR_CONFIG.SECRET_ID,
                        secretKey: ASR_CONFIG.SECRET_KEY,
                        engine_model_type: ASR_CONFIG.ENGINE_MODEL_TYPE,
                        voice_format: ASR_CONFIG.VOICE_FORMAT,
                    });

                    // 设置录音状态
                    // 注意：isRecognizing 会在 OnRecognitionStart 回调中设置
                    this.setData({ isRecording: true });
                    console.log('[ASR] Recording started');
                }
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
     * 停止录音和语音识别
     * 使用 QCloudAIVoice 插件的 stop 方法，同时停止录音和识别
     */
    stopRecording(): void {
        if (this.asrManager && this.data.isRecording) {
            // 使用 ASR 插件的 stop 方法（同时停止录音和识别）
            this.asrManager.stop();

            console.log('[ASR] 已调用 stop 方法');

            // 设置录音状态为 false
            // 注意：isRecognizing 会在 OnRecognitionComplete 回调中设置为 false
            this.setData({ isRecording: false });
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
