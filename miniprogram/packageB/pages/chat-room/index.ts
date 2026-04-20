/**
 * Chat Room Page - 对簿公堂 / 语音申冤页
 */

import { asrService } from '../../../services/asr-service';
import { stsService } from '../../../services/sts-service';
import { wsManager } from '../../../services/websocket-manager';
import type { IEmojiReceiveData } from '../../../types/emoji-websocket';
import type { ISTSCredentials } from '../../../types/sts-api';
import type {
    IChatCompletePayload,
    ISpeechTurnSwitchPayload,
} from '../../../types/verdict-ws';
import { EWSMessageType } from '../../../types/websocket-common';
import { logger } from '../../../utils/logger';

// 引入腾讯云语音识别插件
const QCloudAIVoicePlugin = requirePlugin('QCloudAIVoice');
type AsrManager = ReturnType<
    typeof QCloudAIVoicePlugin.speechRecognizerManager
>;

enum EPhase {
    SpeakerA = 'SPEAKER_A',
    SpeakerB = 'SPEAKER_B',
    Done = 'DONE',
}

enum EReactionSource {
    My = 'my',
    Opponent = 'opponent',
}

interface IReaction {
    id: number;
    emoji: string;
    lane: number; // 0, 1, 2 三条轨道
    timeoutId: number;
    animationData: WechatMiniprogram.AnimationExportResult;
}

interface IChatRoomPageData {
    // 告状须知弹窗
    showNotification: boolean;
    // 提前结束确认弹窗
    showEndEarlyNotification: boolean;

    // 房间标识
    roomId: string;

    // 核心状态机字段
    phase: EPhase;
    remaining: number;
    totalPerTurn: number;

    // 派生权限
    canSpeak: boolean;

    // 切换提示
    showSwitchNotification: boolean;
    switchNotificationText: string;

    // 倒计时状态
    countdownClass: 'normal' | 'warn' | 'danger';

    // 录音状态
    isRecording: boolean;
    // 手指是否按住麦克风（touchstart 后、touchend/cancel 前）
    micPressed: boolean;

    // 表情系统
    myReactions: IReaction[];
    opponentReactions: IReaction[];
    emojiList: string[];
    emojiAnimations: WechatMiniprogram.AnimationExportResult[];

    // 按阶段保存的语音文本（持久化，不因切换阶段而清空）
    speakerAFinal: string; // Phase A 累积最终文本
    speakerALive: string; // Phase A 实时识别文本
    speakerBFinal: string; // Phase B 累积最终文本
    speakerBLive: string; // Phase B 实时识别文本

    // 语音识别状态
    isRecognizing: boolean;
    recognizeError: string | null;

    // 麦克风权限状态
    hasMicPermission: boolean; // 是否已获得麦克风权限

    // 完成状态（收到 CHAT_COMPLETE 后的过渡）
    isCompleted: boolean;

    // 非发言者提示文案
    listenerHint: string;
    // 对方昵称
    opponentName: string;
    // 第一发言人昵称
    speakerAName: string;
    // 第二发言人昵称
    speakerBName: string;
}

type TSpeakerFinal = Pick<IChatRoomPageData, 'speakerAFinal' | 'speakerBFinal'>;

type TSpeakerLive = Pick<IChatRoomPageData, 'speakerALive' | 'speakerBLive'>;

type TPendingAsrAction =
    | 'sendTurnEnd'
    | 'sendTurnEndAndNotify'
    | 'showSwitchNotification'
    | 'redirect';

interface IChatRoomCustomOption extends WechatMiniprogram.Page.CustomOption {
    timerId: number | null;
    listenerHintTimerId: number | null;
    switchNotificationTimerId: number | null;
    reactionIdCounter: number;
    myReactionTimeouts: number[];
    opponentReactionTimeouts: number[];
    rpxToPx: number;
    asrManager: AsrManager; // 语音识别管理器
    stsCredentials: ISTSCredentials | null; // STS 临时凭证
    currentSpeakerUserId: string; // UserId of current speaker
    isSelfFirstSpeaker: boolean; // Whether self is first speaker (SpeakerA)
    // ASR 完成后的待执行动作（用于确保录音结果先于控制消息发出）
    pendingAfterAsrComplete: TPendingAsrAction | null;
    pendingAfterAsrCompleteTimerId: number | null;
    // 麦克风权限被明确拒绝（通过预检知道，不触发 re-render）
    micPermissionDenied: boolean;
}

const EMOJI_LIST = [
    '😠',
    '😢',
    '❤️',
    '💩',
    '😂',
    '😅',
    '🥺',
    '💨',
    '👍',
    '👎',
    '🧎',
    '💣',
    '👄',
    '🌹',
    '🧧',
];
const MAX_REACTIONS = 3;
const REACTION_DURATION_MIN = 5000;
const REACTION_DURATION_MAX = 7000;
const TOTAL_PER_TURN = 60;
const PHASE_TRANSITION: Record<EPhase, EPhase> = {
    [EPhase.SpeakerA]: EPhase.SpeakerB,
    [EPhase.SpeakerB]: EPhase.Done,
    [EPhase.Done]: EPhase.Done,
};
const REACTION_LANES = [0, 1, 2];

const DEFAULT_OPPONENT_NAME = '对方';

function buildListenerHints(name: string): string[] {
    return [
        `${name} 正在嗷嗷大叫中…`,
        '大老爷正在洗耳恭听…',
        `${name} 正在声泪俱下…`,
        `${name} 正在慷慨陈词中…`,
        `${name} 正在卖惨中…`,
        '请稍安勿躁，马上轮到你…',
    ];
}

const LISTENER_HINT_INTERVAL_MS = 10000;
const SWITCH_NOTIFICATION_DURATION_MS = 2000;

/**
 * ASR 语音识别配置
 * SecretId 和 SecretKey 通过 STS 服务从后端获取临时凭证
 */
const ASR_CONFIG = {
    APP_ID: '1401269739',
    ENGINE_MODEL_TYPE: '16k_zh', // 16k 中文普通话通用模型
    VOICE_FORMAT: 1, // 1: PCM, 4: speex(sp)压缩, 6: silk, 8: mp3
} as const;

Page<IChatRoomPageData, IChatRoomCustomOption>({
    data: {
        showNotification: true,
        showEndEarlyNotification: false,

        roomId: '',

        phase: EPhase.SpeakerA,
        remaining: TOTAL_PER_TURN,
        totalPerTurn: TOTAL_PER_TURN,

        canSpeak: true,

        showSwitchNotification: false,
        switchNotificationText: '下一位',

        countdownClass: 'normal',

        isRecording: false,
        micPressed: false,

        myReactions: [],
        opponentReactions: [],
        emojiList: EMOJI_LIST,
        emojiAnimations: [],

        // 按阶段保存的语音文本
        speakerAFinal: '',
        speakerALive: '',
        speakerBFinal: '',
        speakerBLive: '',

        isRecognizing: false,
        recognizeError: null,

        // 麦克风权限状态
        hasMicPermission: false,

        // 完成状态
        isCompleted: false,

        // 非发言者提示文案
        listenerHint: '',
        // 对方昵称
        opponentName: '',
        // 第一/第二发言人昵称
        speakerAName: '',
        speakerBName: '',
    },

    timerId: null,
    listenerHintTimerId: null,
    switchNotificationTimerId: null,
    reactionIdCounter: 0,
    myReactionTimeouts: [],
    opponentReactionTimeouts: [],
    rpxToPx: 0.5,
    asrManager: null,
    stsCredentials: null,
    currentSpeakerUserId: '',
    isSelfFirstSpeaker: false,
    pendingAfterAsrComplete: null,
    pendingAfterAsrCompleteTimerId: null,
    micPermissionDenied: false,

    onLoad(_options): void {
        const app = getApp<IAppOption>();
        const {
            selfUserId,
            opponentNickname,
            firstSpeakerUserId,
            roomId,
            selfNickname,
        } = app.globalData;

        // 校验 roomCode
        if (!roomId) {
            void wx.showToast({ title: '房间号无效', icon: 'error' });
            setTimeout(() => {
                void wx.navigateBack();
            }, 1500);
            return;
        }

        this.currentSpeakerUserId = firstSpeakerUserId;
        this.isSelfFirstSpeaker = selfUserId === firstSpeakerUserId;
        const canSpeak: boolean = this.currentSpeakerUserId === selfUserId;

        const opponentName: string = opponentNickname || DEFAULT_OPPONENT_NAME;
        const speakerAName: string = this.isSelfFirstSpeaker
            ? selfNickname
            : opponentName;
        const speakerBName: string = this.isSelfFirstSpeaker
            ? opponentName
            : selfNickname;

        // 计算 rpx → px 换算比例
        const sysInfo = wx.getSystemInfoSync();
        this.rpxToPx = sysInfo.windowWidth / 750;

        // 初始化表情按钮动画数据
        const emojiAnimations: WechatMiniprogram.AnimationExportResult[] =
            EMOJI_LIST.map(() => {
                const a = wx.createAnimation({ duration: 0 });
                a.step();
                return a.export();
            });

        this.setData({
            roomId,
            totalPerTurn: TOTAL_PER_TURN,
            remaining: TOTAL_PER_TURN,
            phase: EPhase.SpeakerA,
            canSpeak,
            countdownClass: this.getCountdownClass(TOTAL_PER_TURN),
            emojiAnimations,
            listenerHint: canSpeak ? '' : this.pickListenerHint(opponentName),
            opponentName,
            speakerAName,
            speakerBName,
        });

        // 非发言者启动提示文案轮播
        if (!canSpeak) {
            this.startListenerHintRotation();
        }

        // 初始化 ASR WebSocket 服务
        this.initASRService();

        // 初始化语音识别管理器
        this.initAsrManager();

        // 预热 STS 凭证（发言者首次按麦时无需等待网络）
        if (canSpeak) {
            this.prewarmStsCredentials();
        }

        // 预检麦克风权限状态（缓存 granted/denied，避免 touchstart 时走 getSetting 异步链）
        this.preCheckMicPermission();
    },

    onShow(): void {
        // 仅在发言者页面重新启动定时器
        if (
            !this.timerId &&
            this.data.phase !== EPhase.Done &&
            this.data.canSpeak &&
            this.data.hasMicPermission
        ) {
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

        // 清理提示文案轮播定时器
        this.stopListenerHintRotation();

        // 清理切换提示定时器
        if (this.switchNotificationTimerId) {
            clearTimeout(this.switchNotificationTimerId);
            this.switchNotificationTimerId = null;
        }

        // 清理 ASR pending action 定时器
        if (this.pendingAfterAsrCompleteTimerId) {
            clearTimeout(this.pendingAfterAsrCompleteTimerId);
            this.pendingAfterAsrCompleteTimerId = null;
        }
        this.pendingAfterAsrComplete = null;

        // 停止语音识别
        if (this.asrManager && this.data.isRecording) {
            this.asrManager.stop();
        }

        // 清理 ASR WebSocket 服务
        asrService.cleanup();

        // 清理所有表情 timeout
        [...this.myReactionTimeouts, ...this.opponentReactionTimeouts].forEach(
            id => {
                clearTimeout(id);
            }
        );
        this.myReactionTimeouts = [];
        this.opponentReactionTimeouts = [];
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
     * 随机选取一条不重复的非发言者提示文案
     */
    pickListenerHint(nameOverride?: string): string {
        const name: string =
            nameOverride ?? this.data.opponentName ?? DEFAULT_OPPONENT_NAME;
        const hints: string[] = buildListenerHints(name);
        const current: string = this.data.listenerHint;
        const candidates: string[] = hints.filter(h => h !== current);
        const pool: string[] = candidates.length > 0 ? candidates : hints;
        const idx: number = Math.floor(Math.random() * pool.length);
        return pool[idx];
    },

    /**
     * 启动非发言者提示文案轮播（每 10s 换一条）
     */
    startListenerHintRotation(): void {
        this.stopListenerHintRotation();
        this.listenerHintTimerId = setInterval(() => {
            this.setData({
                listenerHint: this.pickListenerHint(),
            });
        }, LISTENER_HINT_INTERVAL_MS) as unknown as number;
    },

    /**
     * 停止非发言者提示文案轮播
     */
    stopListenerHintRotation(): void {
        if (this.listenerHintTimerId) {
            clearInterval(this.listenerHintTimerId);
            this.listenerHintTimerId = null;
        }
    },

    /**
     * 阻止触摸事件穿透
     */
    preventTouchMove(): void {
        // 空函数，仅用于阻止事件冒泡
    },

    /**
     * 显示切换提示（"下一位"）
     * 2 秒后自动隐藏
     */
    async showSwitchNotification(): Promise<void> {
        // 清理之前的定时器
        if (this.switchNotificationTimerId) {
            clearTimeout(this.switchNotificationTimerId);
            this.switchNotificationTimerId = null;
        }
        await wx.vibrateLong();
        this.setData({
            showSwitchNotification: true,
            switchNotificationText: '下一位',
        });

        this.switchNotificationTimerId = setTimeout(() => {
            this.setData({ showSwitchNotification: false });
            this.switchNotificationTimerId = null;
        }, SWITCH_NOTIFICATION_DURATION_MS) as unknown as number;
    },

    /**
     * 初始化 ASR WebSocket 服务
     * 处理 ASR 文本的 WebSocket 同步
     */
    initASRService(): void {
        const { roomId } = this.data;
        const userId: string = getApp<IAppOption>().globalData.selfUserId;

        if (!roomId || !userId) {
            logger.warn(
                'ChatRoom',
                'Cannot init ASR service: missing roomId or userId'
            );
            return;
        }

        asrService.initialize({
            roomId,
            speakerId: userId,
            onASRTextReceive: (
                _speakerId: string,
                text: string,
                isFinal: boolean,
                _seq: number
            ) => {
                this.handleOpponentASRText(text, isFinal);
            },
            onError: (errorMessage: string) => {
                logger.error('ChatRoom', 'ASR service error:', errorMessage);
            },
            onUnhandledMessage: (data: string) => {
                this.handleUnhandledWsMessage(data);
            },
        });

        logger.log('ChatRoom', 'ASR service initialized');
    },

    /**
     * 获取本地发言对应的 data key（基于是否先发言，不受阶段切换影响）
     * 先发言者在 SpeakerA 发言，后发言者在 SpeakerB 发言
     */
    getLocalSpeechKeys(): {
        finalKey: keyof TSpeakerFinal;
        liveKey: keyof TSpeakerLive;
    } {
        if (this.isSelfFirstSpeaker) {
            return { finalKey: 'speakerAFinal', liveKey: 'speakerALive' };
        }
        return { finalKey: 'speakerBFinal', liveKey: 'speakerBLive' };
    },

    /**
     * 获取对方发言对应的 data key（基于是否先发言，不受阶段切换影响）
     */
    getOpponentSpeechKeys(): {
        finalKey: keyof TSpeakerFinal;
        liveKey: keyof TSpeakerLive;
    } {
        if (this.isSelfFirstSpeaker) {
            return { finalKey: 'speakerBFinal', liveKey: 'speakerBLive' };
        }
        return { finalKey: 'speakerAFinal', liveKey: 'speakerALive' };
    },

    /**
     * 处理对方的 ASR 文本
     * 基于角色确定写入 key，避免阶段切换竞态
     */
    handleOpponentASRText(text: string, isFinal: boolean): void {
        const { finalKey, liveKey } = this.getOpponentSpeechKeys();

        if (isFinal) {
            const existingFinal: string =
                this.data[finalKey as keyof TSpeakerFinal];
            const textWithPunctuation: string = this.addPeriodIfNeeded(text);
            const newFinal: string = existingFinal
                ? existingFinal + textWithPunctuation
                : textWithPunctuation;
            this.setData({
                [finalKey]: newFinal,
                [liveKey]: '',
            });
            logger.log('ChatRoom', 'Opponent final text:', newFinal);
        } else {
            this.setData({ [liveKey]: text });
        }
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

            logger.log('ChatRoom', 'ASR manager initialized');
        } catch (err) {
            logger.error('ChatRoom', 'Failed to initialize ASR manager:', err);
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
            logger.error(
                'ChatRoom',
                'Cannot init callbacks: asrManager is null'
            );
            return;
        }

        const manager = this.asrManager;

        // 1. 开始识别
        manager.OnRecognitionStart = (res: unknown) => {
            logger.log('ChatRoom', '开始识别', res);
            this.setData({
                isRecognizing: true,
                recognizeError: null,
            });
            // 识别真正开始时给一次中等震动，提示用户可以开口说话
            if (this.data.canSpeak) {
                void wx.vibrateShort({ type: 'medium' });
            }
        };

        // 3. 识别变化时（发送 partial，节流后）
        manager.OnRecognitionResultChange = (res: unknown) => {
            logger.log('ChatRoom', '识别变化时', res);
            const result = res as {
                result?: { voice_text_str?: string };
            } | null;
            if (result?.result?.voice_text_str) {
                const text = result.result.voice_text_str;
                const { liveKey } = this.getLocalSpeechKeys();
                this.setData({ [liveKey]: text });
                asrService.sendPartial(text);
            }
        };

        // 4. 一句话结束 — 立即累积到本地 final 并发送给对方
        manager.OnSentenceEnd = (res: unknown) => {
            logger.log('ChatRoom', '一句话结束', res);
            const result = res as {
                result?: { voice_text_str?: string };
            } | null;
            if (result?.result?.voice_text_str) {
                const text = result.result.voice_text_str;
                const { finalKey, liveKey } = this.getLocalSpeechKeys();
                const existing: string =
                    this.data[finalKey as keyof TSpeakerFinal];
                const withPunc: string = this.addPeriodIfNeeded(text);
                const newFinal: string = existing
                    ? existing + withPunc
                    : withPunc;
                this.setData({
                    [finalKey]: newFinal,
                    [liveKey]: '',
                });
                asrService.sendFinal(text);
            }
        };

        // 5. 识别结束 — 仅处理未被 OnSentenceEnd 捕获的残余文本，然后执行挂起的动作
        manager.OnRecognitionComplete = (res: unknown) => {
            logger.log('ChatRoom', '识别结束', res);
            const { finalKey, liveKey } = this.getLocalSpeechKeys();
            const liveText: string = this.data[liveKey as keyof TSpeakerLive];

            if (liveText) {
                // 有残余 live 文本（未触发 OnSentenceEnd），固化它
                const existing: string =
                    this.data[finalKey as keyof TSpeakerFinal];
                const withPunc: string = this.addPeriodIfNeeded(liveText);
                const newFinal: string = existing
                    ? existing + withPunc
                    : withPunc;
                this.setData({
                    [finalKey]: newFinal,
                    [liveKey]: '',
                    isRecognizing: false,
                });
                asrService.sendFinal(liveText);
            } else {
                this.setData({
                    [liveKey]: '',
                    isRecognizing: false,
                });
            }

            // 清除兜底超时
            if (this.pendingAfterAsrCompleteTimerId) {
                clearTimeout(this.pendingAfterAsrCompleteTimerId);
                this.pendingAfterAsrCompleteTimerId = null;
            }

            // 执行挂起的动作（录音结果已全部发送，现在安全地发控制消息或跳转）
            const pending = this.pendingAfterAsrComplete;
            this.pendingAfterAsrComplete = null;
            if (pending) {
                this.executePendingAction(pending);
            }
        };

        // 6. 识别错误
        manager.OnError = (res: unknown) => {
            logger.log('ChatRoom', '识别失败', res);
            this.handleRecognizeError('语音识别失败');
        };

        // 7. 录音结束（最长10分钟）时回调
        manager.OnRecorderStop = (res: unknown) => {
            logger.log('ChatRoom', '录音结束', res);
        };

        logger.log('ChatRoom', 'All callbacks registered');
    },

    /**
     * 处理语音识别错误
     * 更新错误状态、重置识别状态并显示 Toast 提示
     * @param errorMessage 错误信息字符串
     */
    handleRecognizeError(errorMessage: string): void {
        // 1. 记录错误日志
        logger.error('ChatRoom', '识别错误', errorMessage);

        // 2. 更新状态
        const { liveKey } = this.getLocalSpeechKeys();
        this.setData({
            recognizeError: errorMessage,
            isRecognizing: false,
            micPressed: false,
            [liveKey]: '',
        });

        // 3. 显示 Toast 提示
        void wx.showToast({
            title: '语音识别失败',
            icon: 'error',
            duration: 2000,
        });
    },

    /**
     * 预检麦克风权限状态（在 onLoad 中调用）
     * 缓存 granted / denied 状态，使 touchstart 时无需再走 getSetting 异步链。
     * 未请求过（undefined）不做处理，等用户按麦时直接调 wx.authorize。
     */
    preCheckMicPermission(): void {
        wx.getSetting({
            success: res => {
                const auth = res.authSetting['scope.record'];
                if (auth === true) {
                    this.setData({ hasMicPermission: true });
                } else if (auth === false) {
                    this.micPermissionDenied = true;
                }
            },
        });
    },

    /**
     * 显示麦克风权限被拒绝的弹窗，引导用户前往系统设置开启
     */
    showMicPermissionDeniedModal(): void {
        void wx.showModal({
            title: '需要录音权限',
            content: '小主，没有麦麦怎么伸冤',
            confirmText: '去设置',
            cancelText: '取消',
            success: res => {
                if (res.confirm) {
                    void wx.openSetting({
                        success: settingRes => {
                            if (
                                settingRes.authSetting['scope.record'] === true
                            ) {
                                // 用户在设置中开启了权限
                                this.micPermissionDenied = false;
                                this.onMicPermissionGranted();
                            } else {
                                // 用户仍未开启权限，再次显示弹窗
                                this.showMicPermissionDeniedModal();
                            }
                        },
                    });
                }
                // 如果用户点取消，不启动定时器，页面停留在未开始状态
            },
        });
    },

    /**
     * 麦克风权限获得后的回调
     * 设置权限状态、启动倒计时并开始录音
     */
    onMicPermissionGranted(): void {
        this.setData({ hasMicPermission: true });

        // 授权完成时按钮可能已松开（auth 流中已提前重置 micPressed）
        // 仅在仍按住的情况下才启动录音，否则等用户重新按下
        if (!this.data.micPressed) {
            return;
        }

        if (!this.timerId) {
            this.startTimer();
        }
        void wx.vibrateShort({ type: 'light' });
        this.startRecording();
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

        // 最后 5 秒每秒震动
        if (remaining <= 5 && remaining > 0) {
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
        const { phase, totalPerTurn, canSpeak } = this.data;
        // 根据当前阶段直接计算 liveKey（同步，无竞态问题）
        const liveKey: 'speakerALive' | 'speakerBLive' =
            phase === EPhase.SpeakerA ? 'speakerALive' : 'speakerBLive';
        const wasRecording: boolean = this.data.isRecording;

        // 强制停止语音识别，并在 ASR 完成后发送控制消息并显示切换提示（确保录音结果先到后端）
        if (this.asrManager && wasRecording) {
            if (canSpeak) {
                this.stopAsrAndDefer('sendTurnEndAndNotify');
            } else {
                this.asrManager.stop();
            }
        } else if (canSpeak) {
            // 未在录音，直接发送
            this.sendSpeechTurnEnd();
        }

        const nextPhase: EPhase = PHASE_TRANSITION[phase];

        if (nextPhase === EPhase.Done) {
            // 清理定时器
            if (this.timerId) {
                clearInterval(this.timerId);
                this.timerId = null;
            }

            this.stopListenerHintRotation();

            this.setData({
                phase: EPhase.Done,
                canSpeak: false,
                remaining: 0,
                isRecording: false,
                [liveKey]: '', // 仅清 live，final 保留
            });
            // 等待 CHAT_COMPLETE 消息触发跳转
        } else {
            const phaseApp = getApp<IAppOption>();
            // 第二发言人是非第一发言人的那一方
            this.currentSpeakerUserId = this.isSelfFirstSpeaker
                ? phaseApp.globalData.opponentUserId
                : phaseApp.globalData.selfUserId;
            const nextCanSpeak: boolean =
                this.currentSpeakerUserId === phaseApp.globalData.selfUserId;

            // 不再发言时停止倒计时（由新发言者自行启动）
            if (!nextCanSpeak && this.timerId) {
                clearInterval(this.timerId);
                this.timerId = null;
            }

            // 显示"下一位"切换提示（录音中则等 OnRecognitionComplete 确认最后一段文本已发出）
            if (!(this.asrManager && wasRecording)) {
                void this.showSwitchNotification();
            }

            this.setData({
                phase: nextPhase,
                remaining: totalPerTurn,
                canSpeak: nextCanSpeak,
                countdownClass: this.getCountdownClass(totalPerTurn),
                isRecording: false,
                [liveKey]: '', // 仅清结束阶段的 live
                listenerHint: nextCanSpeak ? '' : this.pickListenerHint(),
            });

            if (nextCanSpeak) {
                this.stopListenerHintRotation();
            } else {
                this.startListenerHintRotation();
            }

            asrService.resetSequence();
        }
    },

    /**
     * 强制停止 ASR 并将指定动作延迟到 OnRecognitionComplete 后执行
     * 确保录音结果先于控制消息/跳转发出。
     * 兜底：3 秒内回调未触发时直接执行该动作。
     */
    stopAsrAndDefer(action: TPendingAsrAction): void {
        // 先赋值再 stop，避免回调先于赋值到达
        this.pendingAfterAsrComplete = action;
        this.pendingAfterAsrCompleteTimerId = setTimeout(() => {
            if (this.pendingAfterAsrComplete === action) {
                this.pendingAfterAsrComplete = null;
                this.executePendingAction(action);
            }
            this.pendingAfterAsrCompleteTimerId = null;
        }, 3000) as unknown as number;
        this.asrManager.stop();
    },

    /**
     * 执行 pendingAfterAsrComplete 挂起的动作
     */
    executePendingAction(action: TPendingAsrAction): void {
        switch (action) {
            case 'sendTurnEnd':
                this.sendSpeechTurnEnd();
                break;
            case 'sendTurnEndAndNotify':
                this.sendSpeechTurnEnd();
                void this.showSwitchNotification();
                break;
            case 'showSwitchNotification':
                void this.showSwitchNotification();
                break;
            case 'redirect':
                this.doRedirectToVerdictWaiting();
                break;
        }
    },

    /**
     * 发送 SPEECH_TURN_END 给服务器
     * 当本方发言轮次结束时调用
     */
    sendSpeechTurnEnd(): void {
        const roomId: string = this.data.roomId;
        const userId: string = getApp<IAppOption>().globalData.selfUserId;

        if (!roomId || !userId) {
            logger.warn(
                'ChatRoom',
                'Cannot send SPEECH_TURN_END: missing roomId or userId'
            );
            return;
        }

        wsManager.send({
            type: EWSMessageType.SpeechTurnEnd,
            data: { roomId, userId },
            timestamp: Date.now(),
        });

        logger.log('ChatRoom', 'Sent SPEECH_TURN_END');
    },

    /**
     * 处理 SPEECH_TURN_SWITCH 消息
     * 第一位发言者结束后，服务器通知切换发言人
     * 已在正确阶段的一方（发送者）忽略，未切换的一方更新状态
     */
    handleSpeechTurnSwitch(payload: ISpeechTurnSwitchPayload): void {
        const { phase, totalPerTurn } = this.data;

        // 已经不在 SpeakerA 阶段，忽略
        if (phase !== EPhase.SpeakerA) {
            logger.log('ChatRoom', 'SPEECH_TURN_SWITCH ignored');
            return;
        }

        logger.log('ChatRoom', 'SPEECH_TURN_SWITCH → SpeakerB');

        this.currentSpeakerUserId = payload.nextSpeakerUserId;
        const selfUserId: string = getApp<IAppOption>().globalData.selfUserId;
        const nextCanSpeak: boolean = this.currentSpeakerUserId === selfUserId;

        // 显示"下一位"切换提示（录音中则等 OnRecognitionComplete 确认最后一段文本已发出）
        const wasRecording: boolean = this.data.isRecording;
        if (this.asrManager && wasRecording) {
            this.stopAsrAndDefer('showSwitchNotification');
        } else {
            void this.showSwitchNotification();
        }

        this.setData({
            phase: EPhase.SpeakerB,
            remaining: totalPerTurn,
            canSpeak: nextCanSpeak,
            countdownClass: this.getCountdownClass(totalPerTurn),
            isRecording: false,
            speakerALive: '', // 清 Phase A live，final 保留
            listenerHint: nextCanSpeak ? '' : this.pickListenerHint(),
        });

        if (nextCanSpeak) {
            this.stopListenerHintRotation();
            // 预热 STS 凭证，让第二发言者首次按麦时无需等待网络
            this.prewarmStsCredentials();
        } else {
            this.startListenerHintRotation();
        }

        asrService.resetSequence();
    },

    /**
     * 处理 CHAT_COMPLETE 消息
     * 双方发言均已结束：先强制停录音、确保 ASR 结果发送完毕，再跳转 verdict-waiting
     */
    handleChatComplete(_payload: IChatCompletePayload): void {
        // 防止重复处理
        if (this.data.isCompleted) {
            return;
        }

        logger.log('ChatRoom', 'CHAT_COMPLETE received');

        // 清理倒计时定时器
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        this.stopListenerHintRotation();

        const wasRecording: boolean = this.data.isRecording;

        // 显示"判官已知悉"过渡遮罩（不启动自动隐藏，跳转前保持可见）
        this.setData({
            phase: EPhase.Done,
            isCompleted: true,
            canSpeak: false,
            remaining: 0,
            isRecording: false,
            showSwitchNotification: true,
            switchNotificationText: '判官已知悉',
        });

        if (this.asrManager && wasRecording) {
            // 等 OnRecognitionComplete 回调确认最后一段文本已发出，再跳转
            this.stopAsrAndDefer('redirect');
        } else {
            // 未在录音，短暂展示遮罩后跳转
            setTimeout(() => {
                this.doRedirectToVerdictWaiting();
            }, 1500);
        }
    },

    /**
     * 跳转到 verdict-waiting 页面
     */
    doRedirectToVerdictWaiting(): void {
        const roomId: string = this.data.roomId;
        void wx.redirectTo({
            url: `/packageB/pages/verdict-waiting/index?roomId=${roomId}`,
        });
    },

    /**
     * 关闭告状须知弹窗
     */
    onNotificationDismiss(): void {
        this.setData({ showNotification: false });
    },

    /**
     * 麦克风按下
     * 首次按下时先完成隐私授权，再申请 scope.record 权限。
     */
    onMicTouchStart(): void {
        if (!this.data.canSpeak) {
            return;
        }

        this.setData({ micPressed: true });

        if (this.data.hasMicPermission) {
            if (!this.timerId) {
                this.startTimer();
            }
            void wx.vibrateShort({ type: 'light' });
            this.startRecording();
        } else if (this.micPermissionDenied) {
            this.showMicPermissionDeniedModal();
        } else {
            this.setData({ micPressed: false });
            this.requestRecordPermission();
        }
    },

    /**
     * 四步授权流程：
     * ① 检查是否需要隐私授权（wx.getPrivacySetting）
     * ② 需要则弹出隐私协议弹窗，用户点同意后继续
     * ③ 调用 wx.requirePrivacyAuthorize 完成 WeChat 侧授权登记
     * ④ 调用 wx.authorize({scope:'scope.record'}) 申请麦克风权限
     */
    requestRecordPermission(): void {
        wx.getPrivacySetting({
            success: res => {
                if (res.needAuthorization) {
                    void wx.showModal({
                        title: '隐私保护提示',
                        content: `本小程序需要使用麦克风进行语音识别，请阅读并同意《${res.privacyContractName}》。`,
                        confirmText: '同意',
                        cancelText: '拒绝',
                        success: modalRes => {
                            if (!modalRes.confirm) {
                                return;
                            }
                            wx.requirePrivacyAuthorize({
                                success: () => {
                                    this.doAuthorizeRecord();
                                },
                                fail: () => {
                                    void wx.showToast({
                                        title: '隐私授权失败，请再次按住麦克风以授权录音',
                                        icon: 'none',
                                        duration: 2000,
                                    });
                                },
                            });
                        },
                    });
                } else {
                    this.doAuthorizeRecord();
                }
            },
            fail: () => {
                void wx.showToast({
                    title: '请再次按住麦克风以授权录音',
                    icon: 'none',
                    duration: 2000,
                });
            },
        });
    },

    /**
     * 申请 scope.record 并处理结果
     * scope.record === false  → 用户明确拒绝 → 引导去小程序设置
     * scope.record === undefined → 用户划掉弹窗 → 提示重试，不锁定状态
     */
    doAuthorizeRecord(): void {
        wx.authorize({
            scope: 'scope.record',
            success: () => {
                this.onMicPermissionGranted();
            },
            fail: () => {
                wx.getSetting({
                    success: settingRes => {
                        if (settingRes.authSetting['scope.record'] === false) {
                            this.micPermissionDenied = true;
                            this.showMicPermissionDeniedModal();
                        } else {
                            void wx.showToast({
                                title: '请再次按住麦克风以授权录音',
                                icon: 'none',
                                duration: 2000,
                            });
                        }
                    },
                    fail: () => {
                        this.micPermissionDenied = true;
                        this.showMicPermissionDeniedModal();
                    },
                });
            },
        });
    },

    /**
     * 麦克风松开
     */
    onMicTouchEnd(): void {
        this.setData({ micPressed: false });
        this.stopRecording();
    },

    /**
     * 麦克风触摸取消
     */
    onMicTouchCancel(): void {
        this.setData({ micPressed: false });
        this.stopRecording();
    },

    /**
     * 提前结束发言：弹出确认弹窗
     */
    onEndEarlyTap(): void {
        if (!this.data.canSpeak) {
            return;
        }
        void wx.vibrateShort({ type: 'medium' });
        this.setData({ showEndEarlyNotification: true });
    },

    /**
     * 确认提前结束发言：关闭弹窗并切换阶段
     */
    onEndEarlyConfirm(): void {
        this.setData({ showEndEarlyNotification: false });
        this.switchPhase();
    },

    /**
     * 取消提前结束发言：关闭弹窗
     */
    onEndEarlyCancel(): void {
        this.setData({ showEndEarlyNotification: false });
    },

    /**
     * 开始录音和语音识别
     * 使用 QCloudAIVoice 插件的 start 方法，同时启动录音和识别
     * 凭证通过 STS 服务从后端获取
     */
    startRecording(): void {
        // 检查权限和 ASR 管理器
        if (!this.data.canSpeak) {
            return;
        }

        if (!this.asrManager) {
            logger.error('ChatRoom', 'asrManager is not initialized');
            void wx.showToast({
                title: '语音识别未初始化',
                icon: 'error',
            });
            return;
        }

        // 清空当前阶段实时识别文本（保留已累积的 final）
        const { liveKey } = this.getLocalSpeechKeys();
        this.setData({
            [liveKey]: '',
            recognizeError: null,
            isRecognizing: false,
        });

        // 重置 ASR 服务序列号（新的录音会话）
        asrService.resetSequence();

        // 权限已在 onMicTouchStart 中检查过，直接启动 ASR
        this.startAsrWithCredentials();
    },

    /**
     * 预热 STS 凭证缓存（fire-and-forget）
     * 提前触发一次 getCredentials，使缓存在用户按麦前就已就绪
     * 错误静默处理：预热失败不影响正常流程，startAsrWithCredentials 会再次尝试
     */
    prewarmStsCredentials(): void {
        stsService.getCredentials().catch((err: unknown) => {
            logger.warn('ChatRoom', 'STS prewarm failed (non-fatal):', err);
        });
    },

    /**
     * 获取 STS 凭证并启动 ASR
     * 使用 stsService 获取临时凭证，然后启动语音识别
     */
    async startAsrWithCredentials(): Promise<void> {
        try {
            // 获取临时凭证
            const credentials = await stsService.getCredentials();
            this.stsCredentials = credentials;

            logger.log('ChatRoom', 'Got STS credentials');

            // 使用临时凭证启动 ASR
            // STS 请求是异步的，期间用户可能已松开按钮，此时不再建立连接
            if (this.asrManager && this.data.micPressed) {
                this.asrManager.start({
                    secretkey: credentials.TmpSecretKey,
                    secretid: credentials.TmpSecretId,
                    token: credentials.Token,
                    appid: ASR_CONFIG.APP_ID,
                    engine_model_type: ASR_CONFIG.ENGINE_MODEL_TYPE,
                    voice_format: ASR_CONFIG.VOICE_FORMAT,
                });

                // 设置录音状态
                // 注意：isRecognizing 会在 OnRecognitionStart 回调中设置
                this.setData({ isRecording: true });
                logger.log(
                    'ChatRoom',
                    'Recording started with STS credentials'
                );
            }
        } catch (error) {
            logger.error('ChatRoom', 'Failed to get STS credentials:', error);
            this.handleRecognizeError('获取凭证失败');
        }
    },

    /**
     * 停止录音和语音识别
     * 使用 QCloudAIVoice 插件的 stop 方法，同时停止录音和识别
     */
    stopRecording(): void {
        if (this.asrManager && this.data.isRecording) {
            // 使用 ASR 插件的 stop 方法（同时停止录音和识别）
            this.asrManager.stop();

            logger.log('ChatRoom', '已调用 stop 方法');

            // 设置录音状态为 false
            // 注意：isRecognizing 会在 OnRecognitionComplete 回调中设置为 false
            this.setData({ isRecording: false });
        }
    },

    /**
     * 发送表情（自己点击表情时）
     */
    onEmojiTap(e: WechatMiniprogram.TouchEvent): void {
        if (this.data.canSpeak) {
            return;
        }

        const emoji = e.currentTarget.dataset.emoji as string;
        if (!emoji) {
            return;
        }

        // 自己的表情同屏最多 3 个
        if (this.data.myReactions.length >= MAX_REACTIONS) {
            return;
        }

        void wx.vibrateShort({ type: 'light' });

        // 表情按钮弹跳动画
        const index = e.currentTarget.dataset.index as number;
        this.animateEmojiButton(index);

        // 通过 WebSocket 发送表情给对方
        this.sendEmojiViaWs(emoji);

        // 本地显示自己的表情
        this.addReaction(EReactionSource.My, emoji);
    },

    /**
     * 表情按钮弹跳动画
     */
    animateEmojiButton(index: number): void {
        const anim = wx.createAnimation({
            duration: 100,
            timingFunction: 'ease-out',
        });

        // 放大弹跳
        anim.scale(1.4).step({ duration: 100 });
        // 回弹复位
        anim.scale(1.0).step({ duration: 150 });

        this.setData({
            [`emojiAnimations[${index}]`]: anim.export(),
        });
    },

    /**
     * 通过 WebSocket 发送表情
     */
    sendEmojiViaWs(emoji: string): void {
        if (!wsManager.isConnected()) {
            logger.error('ChatRoom', 'WebSocket not connected');
            return;
        }

        const roomId: string = this.data.roomId;
        const senderId: string = getApp<IAppOption>().globalData.selfUserId;

        if (!roomId || !senderId) {
            return;
        }

        wsManager.send({
            type: EWSMessageType.EmojiSend,
            data: { roomId, senderId, emoji },
            timestamp: Date.now(),
        });

        logger.log('ChatRoom', 'Sent emoji:', emoji);
    },

    /**
     * 处理未被 ASR 服务处理的 WebSocket 消息
     */
    handleUnhandledWsMessage(data: string): void {
        try {
            const message = JSON.parse(data) as {
                type: EWSMessageType;
                data:
                    | IChatCompletePayload
                    | ISpeechTurnSwitchPayload
                    | IEmojiReceiveData;
            };

            switch (message.type) {
                case EWSMessageType.SpeechTurnSwitch:
                    this.handleSpeechTurnSwitch(
                        message.data as ISpeechTurnSwitchPayload
                    );
                    break;
                case EWSMessageType.ChatComplete:
                    this.handleChatComplete(
                        message.data as IChatCompletePayload
                    );
                    break;
                case EWSMessageType.EmojiReceive:
                    this.handleEmojiReceive(
                        (message.data as IEmojiReceiveData).emoji
                    );
                    break;
                default:
                    break;
            }
        } catch (error) {
            logger.error(
                'ChatRoom',
                'Failed to parse unhandled message:',
                error
            );
        }
    },

    /**
     * 处理收到对方的表情
     */
    handleEmojiReceive(emoji: string): void {
        void wx.vibrateShort({ type: 'heavy' });

        // 对方表情同屏最多 3 个
        if (this.data.opponentReactions.length >= MAX_REACTIONS) {
            return;
        }

        logger.log('ChatRoom', 'Received emoji from opponent:', emoji);

        this.addReaction(EReactionSource.Opponent, emoji);
    },

    /**
     * 添加表情反应（自己或对方）
     * 两步动画：先添加元素（空动画）→ 等 DOM 渲染后再设置飞行动画
     * 必须分两步，因为 wx.createAnimation 只在 animation 属性「变化」时才触发
     */
    addReaction(source: EReactionSource, emoji: string): void {
        const reactions =
            source === EReactionSource.My
                ? this.data.myReactions
                : this.data.opponentReactions;
        const timeouts =
            source === EReactionSource.My
                ? this.myReactionTimeouts
                : this.opponentReactionTimeouts;
        const dataKey =
            source === EReactionSource.My ? 'myReactions' : 'opponentReactions';

        // 分配轨道
        const usedLanes = reactions.map((r: IReaction) => r.lane);
        const availableLanes = REACTION_LANES.filter(
            lane => !usedLanes.includes(lane)
        );

        if (!availableLanes.length) {
            return;
        }

        const lane =
            availableLanes[Math.floor(Math.random() * availableLanes.length)];

        const id = ++this.reactionIdCounter;

        // 3-5 秒后自动消失
        const duration =
            REACTION_DURATION_MIN +
            Math.random() * (REACTION_DURATION_MAX - REACTION_DURATION_MIN);

        const timeoutId = setTimeout(() => {
            this.removeReaction(source, id);
        }, duration) as unknown as number;

        timeouts.push(timeoutId);

        // 第一步：空动画，仅用于创建 DOM 元素
        const initAnim = wx.createAnimation({ duration: 0 });
        initAnim.step();

        const newReaction: IReaction = {
            id,
            emoji,
            lane,
            timeoutId,
            animationData: initAnim.export(),
        };

        // 第二步：先 setData 创建元素，回调中延迟触发飞行动画
        this.setData({ [dataKey]: [...reactions, newReaction] }, () => {
            setTimeout(() => {
                this.startReactionAnimation(dataKey, id);
            }, 50);
        });
    },

    /**
     * 启动表情飞行动画（使用 wx.createAnimation）
     * 三阶段：弹跳放大 → 上浮回弹 → 继续上升淡出
     */
    startReactionAnimation(
        dataKey: 'myReactions' | 'opponentReactions',
        reactionId: number
    ): void {
        const reactions = this.data[dataKey];
        const idx = reactions.findIndex((r: IReaction) => r.id === reactionId);
        if (idx === -1) {
            return;
        }

        const flyMid = Math.round(-150 * this.rpxToPx);
        const flyEnd = Math.round(-400 * this.rpxToPx);

        const animation = wx.createAnimation({
            duration: 200,
            timingFunction: 'ease-out',
        });

        // 第一阶段：弹跳放大
        animation.scale(1.4).step({ duration: 200 });
        // 第二阶段：上浮 + 回弹到正常大小
        animation
            .translateY(flyMid)
            .scale(1.0)
            .step({ duration: 1200, timingFunction: 'ease-out' });
        // 第三阶段：继续上升 + 缩小 + 淡出
        animation
            .translateY(flyEnd)
            .scale(0.6)
            .opacity(0)
            .step({ duration: 1000, timingFunction: 'ease-in' });

        this.setData({
            [`${dataKey}[${idx}].animationData`]: animation.export(),
        });
    },

    /**
     * 移除表情
     */
    removeReaction(source: EReactionSource, id: number): void {
        const dataKey =
            source === EReactionSource.My ? 'myReactions' : 'opponentReactions';
        const timeouts =
            source === EReactionSource.My
                ? this.myReactionTimeouts
                : this.opponentReactionTimeouts;

        const reactions = this.data[dataKey];
        const reaction = reactions.find((r: IReaction) => r.id === id);

        const filtered = reactions.filter((r: IReaction) => r.id !== id);
        this.setData({ [dataKey]: filtered });

        // 从 timeout 列表中移除
        if (reaction) {
            const idx = timeouts.indexOf(reaction.timeoutId);
            if (idx > -1) {
                clearTimeout(reaction.timeoutId);
                timeouts.splice(idx, 1);
            }
        }
    },

    /**
     * 判断文本是否以标点符号结尾，如果没有则添加句号
     * @param text 输入文本
     * @returns 处理后的文本
     */
    addPeriodIfNeeded(text: string): string {
        if (!text) {
            return text;
        }
        // 中英文标点符号
        const punctuationMarks = '。！？；：，、…—·.!?,;:';
        const lastChar = text.charAt(text.length - 1);
        if (punctuationMarks.includes(lastChar)) {
            return text;
        }
        return text + '。';
    },
});
