/**
 * Drum Room Page
 * 震天鼓抢麦 - Real-time competitive tapping game
 *
 * State Machine:
 * INIT -> PREPARE_COUNTDOWN -> RUNNING -> RESULT
 *
 * WebSocket Messages:
 * - Send: DRUM_TAP (batched taps)
 * - Receive: DRUM_TAP (opponent), DRUM_RESULT (final result), PEER_LEFT
 */

import {
    nowServerMs,
    getTimeRemainingMs,
    resetServerTimeOffset,
} from '../../utils/time';
import {
    getRandomFlyText,
    getRandomTrajectory,
    generateFlyTextId,
    getRandomInt,
} from '../../utils/random';
import { vibrateShort, vibrateLong } from '../../utils/haptic';
import { playDrumSound, destroyAudioPool } from '../../utils/audio';
import { TPlayerRole } from '../../types/drum-websocket';
import { drumService } from '../../services/drum-service';

/** Game phase states */
type TGamePhase = 'INIT' | 'PREPARE_COUNTDOWN' | 'RUNNING' | 'RESULT';

/** Fly text item interface */
interface IFlyText {
    id: string;
    text: string;
    x: number;
    y: number;
    rotate: number;
    opacity: number;
}

/** Page data interface */
interface IDrumPageData {
    // Game phase
    phase: TGamePhase;
    roomId: string;

    // Player info
    selfRole: TPlayerRole;
    hostRole: TPlayerRole;
    playerAName: string;
    playerBName: string;

    // Countdown
    runningLeftMs: number;
    runningLeftSec: number;

    // Scores
    scoreA: number;
    scoreB: number;
    progressA: number;
    progressB: number;

    // Interaction
    tapEnabled: boolean;

    // Animations
    drumAnimationData: WechatMiniprogram.AnimationExportResult | null;
    containerAnimationData: WechatMiniprogram.AnimationExportResult | null;

    // Fly texts
    flyTexts: IFlyText[];

    // Result
    winnerRole: TPlayerRole | null;
    resultTitle: string;
    resultSubtitle: string;
    resultVisible: boolean;
}

/** Page options interface (from waiting-room navigation) */
interface IDrumPageOptions {
    roomId?: string;
    selfRole?: TPlayerRole;
    hostRole?: TPlayerRole;
    playerAName?: string;
    playerBName?: string;
}

interface PrivateState {
    _startAtMs: number;
    _endAtMs: number;

    _runningTimer: ReturnType<typeof setInterval> | null;
    _flyTextTimer: ReturnType<typeof setInterval> | null;
    _resultTimer: ReturnType<typeof setInterval> | null;

    _lastShakeTime: number;
}

/** Game timing constants */
const PREPARE_DURATION_MS: number = 3000;
const RUNNING_DURATION_MS: number = 5000;
const RESULT_DISPLAY_MS: number = 2000;
const FLY_TEXT_DURATION_MS: number = 800;
const MAX_SCORE_FOR_PROGRESS: number = 100;

Page<IDrumPageData, WechatMiniprogram.Page.CustomOption & PrivateState>({
    data: {
        phase: 'INIT',
        roomId: '',

        selfRole: 'A',
        hostRole: 'A',
        playerAName: '',
        playerBName: '',

        runningLeftMs: RUNNING_DURATION_MS,
        runningLeftSec: 5,

        scoreA: 0,
        scoreB: 0,
        progressA: 0,
        progressB: 0,

        tapEnabled: false,

        drumAnimationData: null,
        containerAnimationData: null,

        flyTexts: [],

        winnerRole: null,
        resultTitle: '',
        resultSubtitle: '',
        resultVisible: false,
    },

    // Private state (not in data)
    _startAtMs: 0,
    _endAtMs: 0,
    _runningTimer: null,
    _flyTextTimer: null,
    _resultTimer: null,
    _lastShakeTime: 0,

    /**
     * Page lifecycle: onLoad
     */
    onLoad(options: IDrumPageOptions): void {
        console.log('[DrumRoom] onLoad', options);

        // TODO：Initialize audio pool
        // initAudioPool();

        // Parse options from previous page (waiting-room)
        const roomId: string = options.roomId || 'room-001';
        const selfRole: TPlayerRole = (options.selfRole as TPlayerRole) || 'A';
        const hostRole: TPlayerRole = (options.hostRole as TPlayerRole) || 'A';
        const playerAName: string =
            decodeURIComponent(options.playerAName || '') || '小冤家';
        const playerBName: string =
            decodeURIComponent(options.playerBName || '') || '家冤小';

        this.setData({
            roomId,
            selfRole,
            hostRole,
            playerAName,
            playerBName,
        });

        // Initialize drum service with handlers
        drumService.initialize(
            roomId,
            selfRole,
            (role: TPlayerRole, delta: number) => {
                this._handleOpponentTap(role, delta);
            },
            (winnerRole: TPlayerRole) => {
                this._handleServerResult(winnerRole);
            },
            (leftRole: TPlayerRole) => {
                this._handlePeerLeft(leftRole);
            },
            (message: string) => {
                console.error('[DrumRoom] Service error:', message);
            }
        );

        // Start game flow
        this._startGame();
    },

    /**
     * Page lifecycle: onUnload
     */
    onUnload(): void {
        console.log('[DrumRoom] onUnload');
        this._clearAllTimers();
        destroyAudioPool();

        // Cleanup drum service
        drumService.cleanup();
    },

    /**
     * Start game flow
     * 进入页面后直接开始游戏流程
     */
    _startGame(): void {
        console.log('[DrumRoom] Starting game');

        // Reset time offset (use local time)
        resetServerTimeOffset();

        // Calculate timing
        const startAtMs: number = nowServerMs() + PREPARE_DURATION_MS;
        this._startAtMs = startAtMs;
        this._endAtMs = startAtMs + RUNNING_DURATION_MS;

        // Enter prepare countdown phase
        this.setData({
            phase: 'PREPARE_COUNTDOWN',
        });

        // Start countdown component
        const countdown: WechatMiniprogram.Component.TrivialInstance | null =
            this.selectComponent('#countdown');
        if (countdown) {
            countdown.start();
        }
    },

    /**
     * Handle countdown complete event
     */
    onCountdownComplete(): void {
        console.log('[DrumRoom] Countdown complete');
        this._startRunningPhase();
    },

    /**
     * Start 5-second running (tapping) phase
     */
    _startRunningPhase(): void {
        console.log('[DrumRoom] Starting running phase');

        vibrateLong();

        this.setData({
            phase: 'RUNNING',
            tapEnabled: true,
            runningLeftSec: 500,
            runningLeftMs: RUNNING_DURATION_MS,
        });

        // Update countdown every 100ms for smooth display
        this._runningTimer = setInterval(() => {
            const remaining: number = getTimeRemainingMs(this._endAtMs);

            if (remaining <= 0) {
                this._endRunningPhase();
            } else {
                this.setData({
                    runningLeftMs: remaining,
                    runningLeftSec: Math.ceil(remaining / 1000),
                });
            }
        }, 100);
    },

    /**
     * End running phase and show result
     */
    _endRunningPhase(): void {
        console.log('[DrumRoom] Ending running phase');

        this._clearAllTimers();

        this.setData({
            tapEnabled: false,
            runningLeftSec: 0,
        });

        // Flush any pending taps
        drumService.flushPendingTaps();

        // 直接计算结果（暂不等待服务器）
        this._calculateLocalResult();
    },

    /**
     * Calculate result locally (fallback or mock mode)
     */
    _calculateLocalResult(): void {
        const { scoreA, scoreB, hostRole } = this.data;

        let winnerRole: TPlayerRole;
        if (scoreA > scoreB) {
            winnerRole = 'A';
        } else if (scoreB > scoreA) {
            winnerRole = 'B';
        } else {
            // Tie: host wins
            winnerRole = hostRole;
        }

        this._showResult(winnerRole);
    },

    /**
     * Show result overlay and navigate to chat room
     */
    _showResult(winnerRole: TPlayerRole): void {
        console.log('[DrumRoom] Showing result, winner:', winnerRole);

        const isSelfWinner: boolean = winnerRole === this.data.selfRole;

        const resultTitle: string = isSelfWinner
            ? '你抢到了惊堂木！'
            : '手速慢了点…';
        const resultSubtitle: string = isSelfWinner
            ? '你先申冤！'
            : '先听对方说吧';

        vibrateLong();

        this.setData({
            phase: 'RESULT',
            winnerRole,
            resultTitle,
            resultSubtitle,
            resultVisible: true,
        });

        // Navigate to chat room after delay
        this._resultTimer = setTimeout(() => {
            const { roomId, scoreA, scoreB } = this.data;
            const url: string = `/pages/chat-room/index?roomId=${roomId}&firstSpeaker=${winnerRole}&scoreA=${scoreA}&scoreB=${scoreB}`;
            wx.redirectTo({
                url,
                fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
                    console.error('[DrumRoom] Navigate failed:', err);
                },
            });
        }, RESULT_DISPLAY_MS);
    },

    /**
     * Handle drum button tap
     */
    onDrumTap(): void {
        if (!this.data.tapEnabled || this.data.phase !== 'RUNNING') {
            return;
        }

        // Increment local score immediately
        const scoreKey: 'scoreA' | 'scoreB' =
            this.data.selfRole === 'A' ? 'scoreA' : 'scoreB';
        const newScore: number = this.data[scoreKey] + 1;

        this._updateScore(this.data.selfRole, newScore);

        // Trigger feedback
        this._triggerTapFeedback();

        // Queue tap for WS send
        drumService.queueTap();
    },

    /**
     * Update score and progress bar
     */
    _updateScore(role: TPlayerRole, score: number): void {
        const scoreKey: 'scoreA' | 'scoreB' =
            role === 'A' ? 'scoreA' : 'scoreB';

        const updateData: Partial<IDrumPageData> = {
            [scoreKey]: score,
        };

        this.setData(updateData as IDrumPageData);
        this._updateProgress();
    },

    /**
     * Update progress bars based on scores
     */
    _updateProgress(): void {
        const { scoreA, scoreB } = this.data;
        const maxScore: number = Math.max(scoreA, scoreB, 1);
        const scaledMax: number = Math.max(maxScore, MAX_SCORE_FOR_PROGRESS);

        const progressA: number = Math.min(
            Math.round((scoreA / scaledMax) * 100),
            100
        );
        const progressB: number = Math.min(
            Math.round((scoreB / scaledMax) * 100),
            100
        );

        this.setData({ progressA, progressB });
    },

    /**
     * Trigger visual and haptic feedback for tap
     */
    _triggerTapFeedback(): void {
        // Play sound
        playDrumSound();

        // Haptic feedback
        vibrateShort();

        // Drum scale animation
        this._animateDrumScale();

        // Container shake (throttled)
        this._triggerShake();

        // Add fly text
        this._addFlyText();
    },

    /**
     * Animate drum button scale
     */
    _animateDrumScale(): void {
        const animation: WechatMiniprogram.Animation = wx.createAnimation({
            duration: 120,
            timingFunction: 'ease-out',
        });

        animation.scale(0.92, 0.92).step({ duration: 50 });
        animation.scale(1.0, 1.0).step({ duration: 70 });

        this.setData({
            drumAnimationData: animation.export(),
        });
    },

    /**
     * Trigger container shake animation (throttled)
     */
    _triggerShake(): void {
        const now: number = Date.now();
        if (now - this._lastShakeTime < 50) {
            return;
        }
        this._lastShakeTime = now;

        const animation: WechatMiniprogram.Animation = wx.createAnimation({
            duration: 150,
            timingFunction: 'ease-out',
        });

        const offset: number = getRandomInt(-6, 6);
        animation.translateX(offset).step({ duration: 50 });
        animation.translateX(0).step({ duration: 100 });

        this.setData({
            containerAnimationData: animation.export(),
        });
    },

    /**
     * Add fly text above drum
     */
    _addFlyText(): void {
        const trajectory = getRandomTrajectory();
        const flyText: IFlyText = {
            id: generateFlyTextId(),
            text: getRandomFlyText(),
            x: 375 + trajectory.offsetX, // Center of screen (750/2) + offset
            y: 700 + trajectory.offsetY, // Above drum
            rotate: trajectory.rotate,
            opacity: 1,
        };

        const flyTexts: IFlyText[] = [...this.data.flyTexts, flyText];
        this.setData({ flyTexts });

        // Remove fly text after duration
        setTimeout(() => {
            const updatedFlyTexts: IFlyText[] = this.data.flyTexts.filter(
                (ft: IFlyText) => ft.id !== flyText.id
            );
            this.setData({ flyTexts: updatedFlyTexts });
        }, FLY_TEXT_DURATION_MS);
    },

    /**
     * Clear a specific timer
     */
    _clearTimer(
        timerName: '_runningTimer' | '_flyTextTimer' | '_resultTimer'
    ): void {
        if (this[timerName] !== null) {
            clearInterval(this[timerName]);
            clearTimeout(this[timerName]);
            this[timerName] = null;
        }
    },

    /**
     * Clear all timers
     */
    _clearAllTimers(): void {
        this._clearTimer('_runningTimer');
        this._clearTimer('_flyTextTimer');
        this._clearTimer('_resultTimer');
    },

    /**
     * Handle peer left event
     */
    _handlePeerLeft(_leftRole: TPlayerRole): void {
        void wx.showToast({
            title: '对方已离开',
            icon: 'none',
        });
    },

    /**
     * Handle opponent tap event from server
     */
    _handleOpponentTap(role: TPlayerRole, delta: number): void {
        // Only update if it's the opponent's tap
        if (role === this.data.selfRole) {
            return;
        }

        const scoreKey: 'scoreA' | 'scoreB' =
            role === 'A' ? 'scoreA' : 'scoreB';
        const newScore: number = this.data[scoreKey] + delta;

        this._updateScore(role, newScore);
    },

    /**
     * Handle server result message
     */
    _handleServerResult(winnerRole: TPlayerRole): void {
        // Clear timers and show result from server
        this._clearAllTimers();

        this.setData({
            tapEnabled: false,
            runningLeftSec: 0,
        });

        this._showResult(winnerRole);
    },
});
