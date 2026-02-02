/**
 * Chat Room Page - 对簿公堂 / 语音申冤页
 */

import type { IMessage } from '../../models/message';
import { EMessageType } from '../../models/message';
import { asrService } from '../../services/asr-service';
import { chatService } from '../../services/chat-service';
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

    // 语音识别相关（本地）
    speechTextLive: string; // 实时识别文本（Partial）
    speechTextFinal: string; // 最终识别文本（Final）
    isRecognizing: boolean; // 是否识别中
    recognizeError: string | null; // 识别错误信息

    // 对方语音识别相关（通过 WebSocket 同步）
    opponentTextLive: string; // 对方实时识别文本
    opponentTextFinal: string; // 对方最终识别文本
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
    APP_ID: '', // TODO: 从后端获取或使用环境变量
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

        // 语音识别相关（本地）
        speechTextLive: '',
        speechTextFinal: '',
        isRecognizing: false,
        recognizeError: null,

        // 对方语音识别相关
        opponentTextLive: '',
        opponentTextFinal: '',
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

        // // 校验 roomCode
        // if (!roomCode) {
        //     void wx.showToast({ title: '房间号无效', icon: 'error' });
        //     setTimeout(() => {
        //         void wx.navigateBack();
        //     }, 1500);
        //     return;
        // }

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

        // 初始化 ASR WebSocket 服务（需要在 chatService 之后初始化）
        this.initASRService();

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

        // 清理 ASR WebSocket 服务
        asrService.cleanup();

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
     * 初始化 ASR WebSocket 服务
     * 处理 ASR 文本的 WebSocket 同步
     */
    initASRService(): void {
        const { roomCode } = this.data;
        const userId: string | null = wx.getStorageSync('userId');

        if (!roomCode || !userId) {
            console.warn(
                '[ChatRoom] Cannot init ASR service: missing roomCode or userId'
            );
            return;
        }

        asrService.initialize(
            roomCode,
            userId,
            // 处理对方的 ASR 文本
            (
                _speakerId: string,
                text: string,
                isFinal: boolean,
                _seq: number
            ) => {
                this.handleOpponentASRText(text, isFinal);
            },
            // 处理错误
            (errorMessage: string) => {
                console.error('[ChatRoom] ASR service error:', errorMessage);
            }
        );

        console.log('[ChatRoom] ASR service initialized');
    },

    /**
     * 处理对方的 ASR 文本
     * @param text 识别文本
     * @param isFinal 是否为最终结果
     */
    handleOpponentASRText(text: string, isFinal: boolean): void {
        if (isFinal) {
            // 最终结果：固化文本
            this.setData({
                opponentTextFinal: text,
                opponentTextLive: text,
            });
            console.log('[ChatRoom] Opponent final text:', text);
        } else {
            // 部分结果：只更新 live
            this.setData({
                opponentTextLive: text,
            });
            console.log('[ChatRoom] Opponent partial text:', text);
        }
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

        const manager = this.asrManager;

        // 1. 开始识别
        manager.OnRecognitionStart = (res: unknown) => {
            console.log('[ASR] 开始识别', res);
            this.setData({
                isRecognizing: true,
                recognizeError: null,
            });
        };

        // 2. 一句话开始
        manager.OnSentenceBegin = (res: unknown) => {
            console.log('[ASR] 一句话开始', res);
        };

        // 3. 识别变化时（发送 partial，节流后）
        manager.OnRecognitionResultChange = (res: unknown) => {
            console.log('[ASR] 识别变化时', res);
            const result = res as {
                result?: { voice_text_str?: string };
            } | null;
            if (result?.result?.voice_text_str) {
                const text = result.result.voice_text_str;
                console.log('[ASR] 实时识别文字:', text);

                // 更新本地 UI
                this.setData({
                    speechTextLive: text,
                });

                // 发送 partial 到对方（节流）
                asrService.sendPartial(text);
            }
        };

        // 4. 一句话结束（发送 final，立即）
        manager.OnSentenceEnd = (res: unknown) => {
            console.log('[ASR] 一句话结束', res);
            const result = res as {
                result?: { voice_text_str?: string };
            } | null;
            if (result?.result?.voice_text_str) {
                const text = result.result.voice_text_str;
                console.log('[ASR] 一句话识别文字:', text);

                // 更新本地 UI
                this.setData({
                    speechTextFinal: text,
                });

                // 发送 final 到对方（立即）- 一句话结束也是 final
                asrService.sendFinal(text);
            }
        };

        // 5. 识别结束（发送 final，立即）
        manager.OnRecognitionComplete = (res: unknown) => {
            console.log('[ASR] 识别结束', res);
            const result = res as {
                result?: { voice_text_str?: string };
            } | null;
            if (result?.result?.voice_text_str) {
                const text = result.result.voice_text_str;
                console.log('[ASR] 最终识别文字:', text);

                // 更新本地 UI
                this.setData({
                    speechTextFinal: text,
                    speechTextLive: text,
                    isRecognizing: false,
                });

                // 发送 final 到对方（立即）
                asrService.sendFinal(text);
            } else {
                this.setData({
                    isRecognizing: false,
                });
            }
        };

        // 6. 识别错误
        manager.OnError = (res: unknown) => {
            console.log('[ASR] 识别失败', res);
            this.handleRecognizeError('语音识别失败');
        };

        // 7. 录音结束（最长10分钟）时回调
        manager.OnRecorderStop = (res: unknown) => {
            console.log('[ASR] 录音结束', res);
        };

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
                // 清空 ASR 文本
                speechTextLive: '',
                speechTextFinal: '',
                opponentTextLive: '',
                opponentTextFinal: '',
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
                // 清空 ASR 文本
                speechTextLive: '',
                speechTextFinal: '',
                opponentTextLive: '',
                opponentTextFinal: '',
            });

            // 重置 ASR 服务序列号
            asrService.resetSequence();
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

        // 重置 ASR 服务序列号（新的录音会话）
        asrService.resetSequence();

        wx.authorize({
            scope: 'scope.record',
            success: () => {
                // 使用 ASR 插件的 start 方法（同时启动录音和识别）
                if (this.asrManager) {
                    this.asrManager.start({
                        secretkey: ASR_CONFIG.SECRET_KEY,
                        secretid: ASR_CONFIG.SECRET_ID,
                        appid: ASR_CONFIG.APP_ID,
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
