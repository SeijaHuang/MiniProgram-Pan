/**
 * Drum Room Page
 * 震天鼓抢麦 - Real-time competitive tapping game
 *
 * State Machine:
 * INIT -> PREPARE_COUNTDOWN -> RUNNING -> RESULT
 *
 * WebSocket Messages:
 * - Send: DRUM_TAP (batched taps)
 * - Receive: DRUM_TAP (opponent), DRUM_RESULT (final result)
 */

import { drumService } from '../../../services/drum-service';
import { playDrumSound, destroyAudioPool } from '../../../utils/audio';
import { vibrateShort, vibrateLong } from '../../../utils/haptic';
import { logger } from '../../../utils/logger';
import {
    getRandomFlyText,
    getRandomTrajectory,
    generateFlyTextId,
    getRandomInt,
} from '../../../utils/random';
import {
    nowServerMs,
    getTimeRemainingMs,
    setServerTimeOffset,
} from '../../../utils/time';

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
    organizerUserId: string;
    joinerUserId: string;
    organizerName: string;
    joinerName: string;

    // Countdown
    runningLeftMs: number;
    runningLeftSec: number;

    // Scores
    organizerScore: number;
    joinerScore: number;
    progressA: number;
    progressB: number;

    // Interaction
    tapEnabled: boolean;

    // Animations
    drumAnimationData: WechatMiniprogram.AnimationExportResult | null;
    containerAnimationData: WechatMiniprogram.AnimationExportResult | null;
    timerAnimationData: WechatMiniprogram.AnimationExportResult | null;
    isLastThreeSeconds: boolean;

    // Fly texts
    flyTexts: IFlyText[];

    // Result
    winnerUserId: string;
    resultTitle: string;
    resultSubtitle: string;
    resultScoreText: string;
    resultVisible: boolean;

    // Rule notification
    showRuleNotification: boolean;
    selfReady: boolean;
    readyCount: number;

    // Hint notification
    showHintNotification: boolean;
    hintNotificationContent: string;
    maxTaps: number;
}

/** Page options interface (from waiting-room navigation) */
interface IDrumPageOptions {
    roomId?: string;
}

interface PrivateState {
    _startAtMs: number;
    _endAtMs: number;

    _runningTimer: ReturnType<typeof setInterval> | null;
    _flyTextTimer: ReturnType<typeof setInterval> | null;
    _resultTimer: ReturnType<typeof setInterval> | null;
    _hintTimer: ReturnType<typeof setTimeout> | null;

    _lastShakeTime: number;
}

/** Game timing constants */
// const PREPARE_DURATION_MS: number = 3000;
const RUNNING_DURATION_MS: number = 10000;
const RESULT_DISPLAY_MS: number = 3000;
const FLY_TEXT_DURATION_MS: number = 800;
const MAX_TAPS: number = 60;
const MAX_SCORE_FOR_PROGRESS: number = MAX_TAPS;

Page<IDrumPageData, WechatMiniprogram.Page.CustomOption & PrivateState>({
    data: {
        phase: 'INIT',
        roomId: '',

        organizerUserId: '',
        joinerUserId: '',
        organizerName: '',
        joinerName: '',

        runningLeftMs: RUNNING_DURATION_MS,
        runningLeftSec: 10,

        organizerScore: 0,
        joinerScore: 0,
        progressA: 0,
        progressB: 0,

        tapEnabled: false,

        drumAnimationData: null,
        containerAnimationData: null,
        timerAnimationData: null,
        isLastThreeSeconds: false,

        flyTexts: [],

        winnerUserId: '',
        resultTitle: '',
        resultSubtitle: '',
        resultScoreText: '',
        resultVisible: false,

        showRuleNotification: false,
        selfReady: false,
        readyCount: 0,

        showHintNotification: true,
        hintNotificationContent: '等待开始...',
        maxTaps: MAX_TAPS,
    },

    // Private state (not in data)
    _startAtMs: 0,
    _endAtMs: 0,
    _runningTimer: null,
    _flyTextTimer: null,
    _resultTimer: null,
    _hintTimer: null,
    _lastShakeTime: 0,

    /**
     * Page lifecycle: onLoad
     */
    onLoad(options: IDrumPageOptions): void {
        logger.log('DrumRoom', 'onLoad', options);

        const roomId: string = options.roomId || '';

        this.setData({ roomId });

        // Initialize drum service with handlers
        drumService.initialize({
            roomId,
            onReady: (
                serverTimeMs: number,
                organizerUserId: string,
                joinerUserId: string,
                organizerNickname: string,
                joinerNickname: string,
                receivedAtMs: number
            ) => {
                this._handleDrumReady(
                    serverTimeMs,
                    organizerUserId,
                    joinerUserId,
                    organizerNickname,
                    joinerNickname,
                    receivedAtMs
                );
            },
            onPlayerReady: (readyCount: number) => {
                this._handlePlayerReady(readyCount);
            },
            onStart: (startAtMs: number) => {
                this._handleDrumStart(startAtMs);
            },
            onTap: (userId: string, delta: number) => {
                this._handleOpponentTap(userId, delta);
            },
            onFinish: () => {
                this._handleDrumFinish();
            },
            onResult: (winnerUserId: string) => {
                this._handleServerResult(winnerUserId);
            },
            onError: (message: string) => {
                logger.error('DrumRoom', 'Service error:', message);
            },
        });
    },

    /**
     * Page lifecycle: onUnload
     */
    onUnload(): void {
        logger.log('DrumRoom', 'onUnload');
        this._clearAllTimers();
        destroyAudioPool();

        // Cleanup drum service
        drumService.cleanup();
    },

    /**
     * Start game flow - Wait for server messages
     */
    _startGame(): void {
        logger.log('DrumRoom', 'Waiting for DRUM_READY from server...');

        // Set initial phase
        this.setData({
            phase: 'INIT',
        });
    },

    /**
     * Handle countdown complete event
     */
    onCountdownComplete(): void {
        logger.log('DrumRoom', 'Countdown complete at:', {
            nowServerMs: nowServerMs(),
            timeSinceStart: nowServerMs() - this._startAtMs,
            remainingToEnd: getTimeRemainingMs(this._endAtMs),
        });
        this.setData({ showRuleNotification: false });
        this._startRunningPhase();
    },

    onRuleNotificationClose(): void {
        this.setData({ showRuleNotification: false });
    },

    onHintNotificationClose(): void {
        this._clearTimer('_hintTimer');
        this.setData({ showHintNotification: false });
    },

    onResultNotificationClose(): void {
        // Close is ignored — navigation will happen automatically after delay
    },

    /**
     * Handle "开始游戏" button tap in rule notification
     * Sends DRUM_START_REQUEST; game starts when both players tap
     */
    onStartGameTap(): void {
        if (this.data.selfReady) {
            return;
        }
        const userId: string = getApp<IAppOption>().globalData.selfUserId;
        drumService.sendStartRequest(userId);
        this.setData({ selfReady: true });
    },

    /**
     * Handle DRUM_PLAYER_READY broadcast from server
     * Updates readyCount so statusText reflects how many players are ready
     */
    _handlePlayerReady(readyCount: number): void {
        this.setData({ readyCount });
    },

    /**
     * Start 10-second running (tapping) phase
     */
    _startRunningPhase(): void {
        this._clearAllTimers();
        logger.log('DrumRoom', 'Running phase start:', {
            nowServerMs: nowServerMs(),
            endAtMs: this._endAtMs,
            remaining: getTimeRemainingMs(this._endAtMs),
            expectedRemaining: RUNNING_DURATION_MS,
        });

        vibrateLong();

        this.setData({
            phase: 'RUNNING',
            tapEnabled: true,
            runningLeftSec: Math.ceil(RUNNING_DURATION_MS / 1000),
            runningLeftMs: RUNNING_DURATION_MS,
            showHintNotification: true,
            hintNotificationContent:
                '击鼓抢麦：在接下来的10秒内请疯狂点击！谁点得多谁先发言！',
            maxTaps: MAX_TAPS,
        });

        this._hintTimer = setTimeout(() => {
            this.setData({ showHintNotification: false });
        }, 2500);

        // Track previous second to detect changes
        let prevSec: number = Math.ceil(RUNNING_DURATION_MS / 1000);

        // Update countdown every 100ms for smooth display
        this._runningTimer = setInterval(() => {
            const remaining: number = getTimeRemainingMs(this._endAtMs);
            if (remaining <= 0) {
                this._endRunningPhase();
            } else {
                const currentSec: number = Math.ceil(remaining / 1000);
                const isLastThree: boolean = currentSec <= 3;

                // Trigger animation when second changes in last 3 seconds
                if (isLastThree && currentSec !== prevSec) {
                    this._animateTimer();
                    vibrateLong();
                }

                prevSec = currentSec;

                this.setData({
                    runningLeftMs: remaining,
                    runningLeftSec: currentSec,
                    isLastThreeSeconds: isLastThree,
                });
            }
        }, 100);
    },

    /**
     * End running phase (local timer backup)
     * Server should send DRUM_FINISH, this is fallback
     */
    _endRunningPhase(): void {
        logger.log('DrumRoom', 'Local timer ended (fallback)');

        this._clearAllTimers();

        this.setData({
            tapEnabled: false,
            runningLeftSec: 0,
        });

        // Flush any pending taps
        drumService.flushPendingTaps();

        // Wait for server DRUM_RESULT (don't calculate locally)
        logger.log('DrumRoom', 'Waiting for server result...');
    },

    /**
     * Show result overlay and navigate to chat room
     */
    _showResult(winnerUserId: string): void {
        logger.log('DrumRoom', 'Showing result, winner:', winnerUserId);

        const selfUserId: string = getApp<IAppOption>().globalData.selfUserId;
        const isSelfWinner: boolean = winnerUserId === selfUserId;

        const resultTitle: string = isSelfWinner
            ? '你抢到了惊堂木！'
            : '手速慢了点…';
        const resultSubtitle: string = isSelfWinner
            ? '你先申冤！'
            : '先听对方说吧';

        const { organizerScore, joinerScore } = this.data;
        const resultScoreText: string = ` ${organizerScore} vs ${joinerScore}`;

        vibrateLong();

        this.setData({
            phase: 'RESULT',
            winnerUserId,
            resultTitle,
            resultSubtitle,
            resultScoreText,
            resultVisible: true,
        });

        // Navigate to chat room after delay
        this._resultTimer = setTimeout(() => {
            wx.redirectTo({
                url: '/packageB/pages/chat-room/index',
                fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
                    logger.error('DrumRoom', 'Navigate failed:', err);
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

        const selfUserId: string = getApp<IAppOption>().globalData.selfUserId;
        const scoreKey: 'organizerScore' | 'joinerScore' =
            selfUserId === this.data.organizerUserId
                ? 'organizerScore'
                : 'joinerScore';
        const currentScore: number = this.data[scoreKey];

        // Ignore taps beyond the cap
        if (currentScore >= MAX_TAPS) {
            return;
        }

        this._updateScore(selfUserId, currentScore + 1);

        // Trigger feedback
        this._triggerTapFeedback();

        // Queue tap for WS send
        drumService.queueTap();
    },

    /**
     * Update score and progress bar
     */
    _updateScore(userId: string, score: number): void {
        const scoreKey: 'organizerScore' | 'joinerScore' =
            userId === this.data.organizerUserId
                ? 'organizerScore'
                : 'joinerScore';

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
        const { organizerScore, joinerScore } = this.data;
        const maxScore: number = Math.max(organizerScore, joinerScore, 1);
        const scaledMax: number = Math.max(maxScore, MAX_SCORE_FOR_PROGRESS);

        const progressA: number = Math.min(
            Math.round((organizerScore / scaledMax) * 100),
            100
        );
        const progressB: number = Math.min(
            Math.round((joinerScore / scaledMax) * 100),
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
     * Animate timer scale for last 3 seconds
     */
    _animateTimer(): void {
        const animation: WechatMiniprogram.Animation = wx.createAnimation({
            duration: 400,
            timingFunction: 'ease-out',
        });

        // Scale up then back to normal
        animation.scale(1.8, 1.8).step({ duration: 150 });
        animation.scale(1.0, 1.0).step({ duration: 250 });

        this.setData({
            timerAnimationData: animation.export(),
        });
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
        timerName:
            | '_runningTimer'
            | '_flyTextTimer'
            | '_resultTimer'
            | '_hintTimer'
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
        this._clearTimer('_hintTimer');
    },

    /**
     * Handle DRUM_READY message from server
     * Syncs server time and updates player info
     */
    _handleDrumReady(
        serverTimeMs: number,
        organizerUserId: string,
        joinerUserId: string,
        organizerNickname: string,
        joinerNickname: string,
        receivedAtMs: number
    ): void {
        logger.log('DrumRoom', 'DRUM_READY received', {
            serverTimeMs,
            organizerUserId,
            joinerUserId,
            organizerNickname,
            joinerNickname,
            receivedAtMs,
        });

        // Sync server time using original receive time (not current time)
        // This avoids queue delay affecting the offset calculation
        setServerTimeOffset(serverTimeMs, receivedAtMs);

        // Update player info from server and show rule notification
        this.setData({
            organizerUserId,
            joinerUserId,
            organizerName: organizerNickname,
            joinerName: joinerNickname,
            phase: 'PREPARE_COUNTDOWN',
            showRuleNotification: true,
            selfReady: false,
            showHintNotification: false,
        });

        logger.log('DrumRoom', 'Server time synced, waiting for DRUM_START...');
    },

    /**
     * Handle DRUM_START message from server
     * Starts countdown and game timer based on server timing
     */
    _handleDrumStart(startAtMs: number): void {
        logger.log('DrumRoom', 'Time values:', {
            startAtMs,
            endAtMs: this._endAtMs,
            nowServerMs: nowServerMs(),
            expectedRemaining: this._endAtMs - nowServerMs(),
        });

        // Calculate end time
        this._startAtMs = startAtMs;
        this._endAtMs = startAtMs + RUNNING_DURATION_MS;

        // Both players ready — close rule notification and start countdown
        this.setData({ showRuleNotification: false });

        // Start countdown component
        const countdown: WechatMiniprogram.Component.TrivialInstance | null =
            this.selectComponent('#countdown');
        if (countdown) {
            countdown.start();
        }

        logger.log('DrumRoom', 'Game scheduled:', {
            startAtMs,
            endAtMs: this._endAtMs,
            nowServerMs: nowServerMs(),
        });
    },

    /**
     * Handle DRUM_FINISH message from server
     * Stops game and waits for result
     */
    _handleDrumFinish(): void {
        logger.log('DrumRoom', 'DRUM_FINISH received', Date.now());

        // Clear timers
        this._clearAllTimers();

        // Disable tapping
        this.setData({
            tapEnabled: false,
            runningLeftSec: 0,
        });

        // Flush any pending taps
        drumService.flushPendingTaps();

        logger.log('DrumRoom', 'Game finished, waiting for DRUM_RESULT...');
    },

    /**
     * Handle opponent tap event from server
     */
    _handleOpponentTap(userId: string, delta: number): void {
        // Only update if it's the opponent's tap
        const selfUserId: string = getApp<IAppOption>().globalData.selfUserId;
        if (userId === selfUserId) {
            return;
        }

        const scoreKey: 'organizerScore' | 'joinerScore' =
            userId === this.data.organizerUserId
                ? 'organizerScore'
                : 'joinerScore';
        const newScore: number = this.data[scoreKey] + delta;

        this._updateScore(userId, newScore);
    },

    /**
     * Handle DRUM_RESULT message from server
     */
    _handleServerResult(winnerUserId: string): void {
        logger.log('DrumRoom', 'DRUM_RESULT received, winner:', winnerUserId);

        // Write winner to globalData for downstream pages
        const app = getApp<IAppOption>();
        app.globalData.firstSpeakerUserId = winnerUserId;

        // Clear timers
        this._clearAllTimers();

        // Disable tapping
        this.setData({
            tapEnabled: false,
            runningLeftSec: 0,
        });

        // Show result from server
        this._showResult(winnerUserId);
    },
});
