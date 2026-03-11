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

import {
    DEFAULT_HOST_NAME,
    DEFAULT_USER_NAME,
    DEFAULT_JOINER_NAME,
} from '../../../constants/defaultValue';
import { drumService } from '../../../services/drum-service';
import { EPlayerRole } from '../../../types/websocket-common';
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
    selfRole: EPlayerRole;
    hostRole: EPlayerRole;
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
    winnerRole: EPlayerRole | null;
    resultTitle: string;
    resultSubtitle: string;
    resultVisible: boolean;
}

/** Page options interface (from waiting-room navigation) */
interface IDrumPageOptions {
    roomId?: string;
    selfRole?: EPlayerRole;
    hostRole?: EPlayerRole;
    organizerName?: string;
    joinerName?: string;
}

interface PrivateState {
    _startAtMs: number;
    _endAtMs: number;

    _runningTimer: ReturnType<typeof setInterval> | null;
    _flyTextTimer: ReturnType<typeof setInterval> | null;
    _resultTimer: ReturnType<typeof setInterval> | null;

    _lastShakeTime: number;
}

/** Get score key by player role */
function getScoreKey(role: EPlayerRole): 'organizerScore' | 'joinerScore' {
    return role === EPlayerRole.Organizer ? 'organizerScore' : 'joinerScore';
}

/** Game timing constants */
// const PREPARE_DURATION_MS: number = 3000;
const RUNNING_DURATION_MS: number = 10000;
const RESULT_DISPLAY_MS: number = 2000;
const FLY_TEXT_DURATION_MS: number = 800;
const MAX_TAPS: number = 60;
const MAX_SCORE_FOR_PROGRESS: number = MAX_TAPS;

Page<IDrumPageData, WechatMiniprogram.Page.CustomOption & PrivateState>({
    data: {
        phase: 'INIT',
        roomId: '',

        selfRole: EPlayerRole.Organizer,
        hostRole: EPlayerRole.Organizer,
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
        logger.log('DrumRoom', 'onLoad', options);

        // TODO：Initialize audio pool
        // initAudioPool();

        // Parse options from previous page (waiting-room)
        const roomId: string = options.roomId || 'room-001';
        const selfRole: EPlayerRole = options.selfRole || EPlayerRole.Organizer;
        const hostRole: EPlayerRole = options.hostRole || EPlayerRole.Organizer;

        // Decode first, then check if it's the default user name
        const rawOrganizerName: string = decodeURIComponent(
            options.organizerName || ''
        );
        const organizerName: string =
            rawOrganizerName && rawOrganizerName !== DEFAULT_USER_NAME
                ? rawOrganizerName
                : DEFAULT_HOST_NAME;

        const rawJoinerName: string = decodeURIComponent(
            options.joinerName || ''
        );
        const joinerName: string =
            rawJoinerName && rawJoinerName !== DEFAULT_USER_NAME
                ? rawJoinerName
                : DEFAULT_JOINER_NAME;

        this.setData({
            roomId,
            selfRole,
            hostRole,
            organizerName,
            joinerName,
        });

        // Initialize drum service with handlers
        drumService.initialize({
            roomId,
            selfRole,
            onReady: (
                serverTimeMs: number,
                hostRole: EPlayerRole,
                organizerName: string,
                joinerName: string,
                receivedAtMs: number
            ) => {
                this._handleDrumReady(
                    serverTimeMs,
                    hostRole,
                    organizerName,
                    joinerName,
                    receivedAtMs
                );
            },
            onStart: (startAtMs: number) => {
                this._handleDrumStart(startAtMs);
            },
            onTap: (role: EPlayerRole, delta: number) => {
                this._handleOpponentTap(role, delta);
            },
            onFinish: () => {
                this._handleDrumFinish();
            },
            onResult: (winnerRole: EPlayerRole) => {
                this._handleServerResult(winnerRole);
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
        this._startRunningPhase();
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
        });

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
    _showResult(winnerRole: EPlayerRole): void {
        logger.log('DrumRoom', 'Showing result, winner:', winnerRole);

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
            const { roomId, selfRole, organizerName, joinerName } = this.data;
            // Winner speaks first (Organizer), loser speaks second (Joiner)
            const chatRole: EPlayerRole =
                selfRole === winnerRole
                    ? EPlayerRole.Organizer
                    : EPlayerRole.Joiner;
            // Opponent in drum = the other player
            const opponentName: string =
                selfRole === EPlayerRole.Organizer ? joinerName : organizerName;
            const url: string =
                `/packageB/pages/chat-room/index?roomCode=${roomId}` +
                `&role=${chatRole}` +
                `&opponentName=${encodeURIComponent(opponentName)}`;
            wx.redirectTo({
                url,
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

        // Increment local score immediately
        const scoreKey: 'organizerScore' | 'joinerScore' = getScoreKey(
            this.data.selfRole
        );
        const currentScore: number = this.data[scoreKey];

        // Ignore taps beyond the cap
        if (currentScore >= MAX_TAPS) {
            return;
        }

        const newScore: number = currentScore + 1;
        this._updateScore(this.data.selfRole, newScore);

        // Trigger feedback
        this._triggerTapFeedback();

        // Queue tap for WS send
        drumService.queueTap();
    },

    /**
     * Update score and progress bar
     */
    _updateScore(role: EPlayerRole, score: number): void {
        const scoreKey: 'organizerScore' | 'joinerScore' = getScoreKey(role);

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
     * Handle DRUM_READY message from server
     * Syncs server time and updates player info
     */
    _handleDrumReady(
        serverTimeMs: number,
        hostRole: EPlayerRole,
        organizerName: string,
        joinerName: string,
        receivedAtMs: number
    ): void {
        logger.log('DrumRoom', 'DRUM_READY received', {
            serverTimeMs,
            hostRole,
            organizerName,
            joinerName,
            receivedAtMs,
        });

        // Sync server time using original receive time (not current time)
        // This avoids queue delay affecting the offset calculation
        setServerTimeOffset(serverTimeMs, receivedAtMs);

        // Update player info from server
        this.setData({
            hostRole,
            organizerName,
            joinerName,
            phase: 'PREPARE_COUNTDOWN',
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
    _handleOpponentTap(role: EPlayerRole, delta: number): void {
        // Only update if it's the opponent's tap
        if (role === this.data.selfRole) {
            return;
        }

        const scoreKey: 'organizerScore' | 'joinerScore' = getScoreKey(role);
        const newScore: number = this.data[scoreKey] + delta;

        this._updateScore(role, newScore);
    },

    /**
     * Handle DRUM_RESULT message from server
     */
    _handleServerResult(winnerRole: EPlayerRole): void {
        logger.log('DrumRoom', 'DRUM_RESULT received, winner:', winnerRole);

        // Clear timers
        this._clearAllTimers();

        // Disable tapping
        this.setData({
            tapEnabled: false,
            runningLeftSec: 0,
        });

        // Show result from server
        this._showResult(winnerRole);
    },
});
