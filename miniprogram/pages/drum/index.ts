/**
 * Drum Room Page
 * 震天鼓抢麦 - Real-time competitive tapping game
 *
 * State Machine:
 * INIT -> PREPARE_COUNTDOWN -> RUNNING -> RESULT
 */

import { wsManager } from '../../services/websocket-manager';
import {
    setServerTimeOffset,
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
import {
    vibrateShort,
    vibrateCountdown,
    vibrateLong,
} from '../../utils/haptic';
import {
    initAudioPool,
    playDrumSound,
    destroyAudioPool,
} from '../../utils/audio';
import {
    EDrumMessageType,
    TPlayerRole,
    TDrumMessage,
    parseDrumMessage,
    createTapMessage,
    IDrumReadyData,
    IDrumStartData,
    IDrumTapData,
    IDrumResultData,
    IPeerLeftData,
} from '../../types/drum-websocket';

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
    overlayVisible: boolean;
    prepareCount: number;
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
    countdownAnimationData: WechatMiniprogram.AnimationExportResult | null;

    // Fly texts
    flyTexts: IFlyText[];

    // Result
    winnerRole: TPlayerRole | null;
    resultTitle: string;
    resultSubtitle: string;
    resultVisible: boolean;

    // Mock mode
    isMockMode: boolean;
}

/** Page options interface */
interface IDrumPageOptions {
    roomId?: string;
    selfRole?: TPlayerRole;
    hostRole?: TPlayerRole;
    playerAName?: string;
    playerBName?: string;
    mock?: string;
}

interface PrivateState {
    _startAtMs: number;
    _endAtMs: number;

    _prepareTimer: number | null;
    _runningTimer: number | null;
    _flyTextTimer: number | null;
    _resultTimer: number | null;
    _tapFlushTimer: number | null;
    _mockOpponentTimer: number | null;

    _pendingDelta: number;
    _lastShakeTime: number;
}

/** Game timing constants */
const PREPARE_DURATION_MS: number = 3000;
const RUNNING_DURATION_MS: number = 5000;
const RESULT_DISPLAY_MS: number = 2000;
const TAP_THROTTLE_MS: number = 100;
const FLY_TEXT_DURATION_MS: number = 800;
const MAX_SCORE_FOR_PROGRESS: number = 50;

Page<IDrumPageData, WechatMiniprogram.Page.CustomOption & PrivateState>({
    data: {
        phase: 'INIT',
        roomId: '',

        selfRole: 'A',
        hostRole: 'A',
        playerAName: '玩家A',
        playerBName: '玩家B',

        overlayVisible: false,
        prepareCount: 3,
        runningLeftMs: RUNNING_DURATION_MS,
        runningLeftSec: 5,

        scoreA: 0,
        scoreB: 0,
        progressA: 0,
        progressB: 0,

        tapEnabled: false,

        drumAnimationData: null,
        containerAnimationData: null,
        countdownAnimationData: null,

        flyTexts: [],

        winnerRole: null,
        resultTitle: '',
        resultSubtitle: '',
        resultVisible: false,

        isMockMode: false,
    },

    // Private state (not in data)
    _startAtMs: 0,
    _endAtMs: 0,
    _prepareTimer: null,
    _runningTimer: null,
    _flyTextTimer: null,
    _resultTimer: null,
    _pendingDelta: 0,
    _tapFlushTimer: null,
    _lastShakeTime: 0,
    _mockOpponentTimer: null,

    /**
     * Page lifecycle: onLoad
     */
    onLoad(options: IDrumPageOptions): void {
        console.log('[DrumRoom] onLoad', options);

        // Initialize audio pool
        initAudioPool();

        // Parse options
        const roomId: string = options.roomId || 'mock-room';
        const selfRole: TPlayerRole = (options.selfRole as TPlayerRole) || 'A';
        const hostRole: TPlayerRole = (options.hostRole as TPlayerRole) || 'A';
        const playerAName: string = options.playerAName || '玩家A';
        const playerBName: string = options.playerBName || '玩家B';
        const isMockMode: boolean = options.mock === '1';

        this.setData({
            roomId,
            selfRole,
            hostRole,
            playerAName,
            playerBName,
            isMockMode,
        });

        if (isMockMode) {
            console.log('[DrumRoom] Running in mock mode');
            this._initMockMode();
        } else {
            this._setupWebSocketHandlers();
        }
    },

    /**
     * Page lifecycle: onUnload
     */
    onUnload(): void {
        console.log('[DrumRoom] onUnload');
        this._clearAllTimers();
        destroyAudioPool();

        if (!this.data.isMockMode) {
            // Remove WS handlers if needed
        }
    },

    /**
     * Initialize mock mode for testing without backend
     */
    _initMockMode(): void {
        // Reset server time offset for mock mode
        resetServerTimeOffset();

        // Simulate server ready after short delay
        setTimeout(() => {
            const mockReadyData: IDrumReadyData = {
                roomId: this.data.roomId,
                serverTimeMs: Date.now(),
                hostRole: this.data.hostRole,
                playerAName: this.data.playerAName,
                playerBName: this.data.playerBName,
            };
            this._handleDrumReady(mockReadyData);

            // Simulate start after another short delay
            setTimeout(() => {
                const startAtMs: number = nowServerMs() + PREPARE_DURATION_MS;
                const mockStartData: IDrumStartData = {
                    roomId: this.data.roomId,
                    startAtMs,
                };
                this._handleDrumStart(mockStartData);
            }, 500);
        }, 300);
    },

    /**
     * Setup WebSocket message handlers
     */
    _setupWebSocketHandlers(): void {
        wsManager.updateCallbacks({
            onMessage: (rawData: string) => {
                const message: TDrumMessage | null = parseDrumMessage(rawData);
                if (!message) return;

                switch (message.type) {
                    case EDrumMessageType.DrumReady:
                        this._handleDrumReady(message.data);
                        break;
                    case EDrumMessageType.DrumStart:
                        this._handleDrumStart(message.data);
                        break;
                    case EDrumMessageType.DrumTap:
                        this._handleDrumTap(message.data);
                        break;
                    case EDrumMessageType.DrumResult:
                        this._handleDrumResult(message.data);
                        break;
                    case EDrumMessageType.PeerLeft:
                        this._handlePeerLeft(message.data);
                        break;
                }
            },
            onDisconnect: () => {
                console.warn('[DrumRoom] WebSocket disconnected');
                // Could show reconnecting UI here
            },
        });
    },

    /**
     * Handle DRUM_READY message
     */
    _handleDrumReady(data: IDrumReadyData): void {
        console.log('[DrumRoom] Received DRUM_READY', data);

        // Sync server time
        setServerTimeOffset(data.serverTimeMs);

        this.setData({
            roomId: data.roomId,
            hostRole: data.hostRole,
            playerAName: data.playerAName,
            playerBName: data.playerBName,
        });
    },

    /**
     * Handle DRUM_START message
     */
    _handleDrumStart(data: IDrumStartData): void {
        console.log('[DrumRoom] Received DRUM_START', data);

        this._startAtMs = data.startAtMs;
        this._endAtMs = data.startAtMs + RUNNING_DURATION_MS;

        // Enter prepare countdown phase
        this.setData({
            phase: 'PREPARE_COUNTDOWN',
            overlayVisible: true,
            prepareCount: 3,
        });

        this._startPrepareCountdown();
    },

    /**
     * Handle DRUM_TAP message (opponent's tap)
     */
    _handleDrumTap(data: IDrumTapData): void {
        // Only process opponent's taps
        if (data.role === this.data.selfRole) return;

        const scoreKey: 'scoreA' | 'scoreB' =
            data.role === 'A' ? 'scoreA' : 'scoreB';
        const newScore: number = this.data[scoreKey] + data.delta;

        this._updateScore(data.role, newScore);
    },

    /**
     * Handle DRUM_RESULT message
     */
    _handleDrumResult(data: IDrumResultData): void {
        console.log('[DrumRoom] Received DRUM_RESULT', data);

        // Stop running phase
        this._clearAllTimers();

        this.setData({
            scoreA: data.scoreA,
            scoreB: data.scoreB,
        });

        this._updateProgress();
        this._showResult(data.winnerRole);
    },

    /**
     * Handle PEER_LEFT message
     */
    _handlePeerLeft(data: IPeerLeftData): void {
        console.log('[DrumRoom] Received PEER_LEFT', data);

        // Current player wins by default
        this._clearAllTimers();

        const winnerRole: TPlayerRole = data.leftRole === 'A' ? 'B' : 'A';
        this._showResult(winnerRole);
    },

    /**
     * Start 3-second prepare countdown
     */
    _startPrepareCountdown(): void {
        let count: number = 3;

        // Initial countdown animation
        this._animateCountdownNumber(count);
        vibrateCountdown();

        this._prepareTimer = setInterval(() => {
            count--;

            if (count > 0) {
                this.setData({ prepareCount: count });
                this._animateCountdownNumber(count);
                vibrateCountdown();
            } else {
                // Countdown finished, start running phase
                this._clearTimer('_prepareTimer');
                this._startRunningPhase();
            }
        }, 1000) as unknown as number;
    },

    /**
     * Animate countdown number (scale + opacity)
     */
    _animateCountdownNumber(num: number): void {
        const animation: WechatMiniprogram.Animation = wx.createAnimation({
            duration: 300,
            timingFunction: 'ease-out',
        });

        // Scale from 1.2 to 1.0, fade in
        animation.scale(1.2, 1.2).opacity(0).step({ duration: 0 });
        animation.scale(1.0, 1.0).opacity(1).step({ duration: 300 });

        this.setData({
            prepareCount: num,
            countdownAnimationData: animation.export(),
        });
    },

    /**
     * Start 5-second running (tapping) phase
     */
    _startRunningPhase(): void {
        console.log('[DrumRoom] Starting running phase');

        vibrateLong();

        this.setData({
            phase: 'RUNNING',
            overlayVisible: false,
            tapEnabled: true,
            runningLeftSec: 5,
            runningLeftMs: RUNNING_DURATION_MS,
        });

        // Start mock opponent if in mock mode
        if (this.data.isMockMode) {
            this._startMockOpponent();
        }

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
        }, 100) as unknown as number;
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
        this._flushPendingTaps();

        if (this.data.isMockMode) {
            // In mock mode, calculate result locally
            this._calculateLocalResult();
        } else {
            // Wait for server result (with timeout fallback)
            setTimeout(() => {
                if (this.data.phase !== 'RESULT') {
                    console.warn(
                        '[DrumRoom] Result timeout, calculating locally'
                    );
                    this._calculateLocalResult();
                }
            }, 800);
        }
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
        }, RESULT_DISPLAY_MS) as unknown as number;
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
        this._queueTap();
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
            y: 450 + trajectory.offsetY, // Above drum
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
     * Queue tap for batched WS send
     */
    _queueTap(): void {
        this._pendingDelta++;

        if (this._tapFlushTimer === null) {
            this._tapFlushTimer = setTimeout(() => {
                this._flushPendingTaps();
            }, TAP_THROTTLE_MS) as unknown as number;
        }
    },

    /**
     * Flush pending taps to server
     */
    _flushPendingTaps(): void {
        if (this._pendingDelta === 0) return;

        const delta: number = this._pendingDelta;
        this._pendingDelta = 0;
        this._tapFlushTimer = null;

        if (!this.data.isMockMode && wsManager.isConnected()) {
            const message = createTapMessage(
                this.data.roomId,
                this.data.selfRole,
                delta
            );
            wsManager.send(message);
        }
    },

    /**
     * Start mock opponent tapping
     */
    _startMockOpponent(): void {
        this._mockOpponentTimer = setInterval(() => {
            if (this.data.phase !== 'RUNNING') {
                this._clearTimer('_mockOpponentTimer');
                return;
            }

            // Random opponent tap (0 or 1)
            const shouldTap: boolean = Math.random() > 0.3;
            if (shouldTap) {
                const opponentRole: TPlayerRole =
                    this.data.selfRole === 'A' ? 'B' : 'A';
                const scoreKey: 'scoreA' | 'scoreB' =
                    opponentRole === 'A' ? 'scoreA' : 'scoreB';
                const newScore: number = this.data[scoreKey] + 1;

                this._updateScore(opponentRole, newScore);
            }
        }, 150) as unknown as number;
    },

    /**
     * Clear a specific timer
     */
    _clearTimer(
        timerName:
            | '_prepareTimer'
            | '_runningTimer'
            | '_flyTextTimer'
            | '_resultTimer'
            | '_tapFlushTimer'
            | '_mockOpponentTimer'
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
        this._clearTimer('_prepareTimer');
        this._clearTimer('_runningTimer');
        this._clearTimer('_flyTextTimer');
        this._clearTimer('_resultTimer');
        this._clearTimer('_tapFlushTimer');
        this._clearTimer('_mockOpponentTimer');
    },
});
