/**
 * Verdict Waiting Page
 * 判决等待页 — AI 分析期间展示动画与文案
 *
 * WebSocket flow:
 * 1. Listen for VERDICT_RESULT → cache result → navigate to verdict
 * 2. Listen for VERDICT_FAILED → show error + optional retry
 * 3. On retry → send VERDICT_RETRY → restart listening
 * 4. On timeout (90s) → show timeout overlay
 */

import {
    LOADING_TEXTS,
    TEXT_POOL_SIZE,
    TEXT_INTERVAL_MS,
    MAX_VISIBLE_TEXTS,
    ANALYSIS_TIMEOUT_MS,
    DOTS_INTERVAL_MS,
    FINAL_TEXT_DELAY_MS,
    MIN_DISPLAY_MS,
} from '../../../constants/verdict-waiting';
import { verdictService } from '../../../services/verdict-service';
import { wsManager } from '../../../services/websocket-manager';
import type { IVerdictResult } from '../../../types/verdict';
import type {
    IVerdictWaitingData,
    ILoadingText,
    IParticle,
} from '../../../types/verdict-waiting';
import type { IVerdictFailedPayload } from '../../../types/verdict-ws';
import { EWSMessageType } from '../../../types/websocket-common';
import { logger } from '../../../utils/logger';

import {
    createAnimationManager,
    createParticleRiseAnimation,
} from './animations';

// ---- Utility functions ----

function shuffleArray<T>(arr: T[]): T[] {
    const result: T[] = [...arr];
    for (let i: number = result.length - 1; i > 0; i--) {
        const j: number = Math.floor(Math.random() * (i + 1));
        const temp: T = result[i];
        result[i] = result[j];
        result[j] = temp;
    }
    return result;
}

function generateParticles(count: number): IParticle[] {
    const particles: IParticle[] = [];
    for (let i: number = 0; i < count; i++) {
        particles.push({
            id: i,
            left: Math.random() * 100,
            size: Math.random() * 4 + 2,
            opacity: Math.random() * 0.5 + 0.3,
            duration: Math.random() * 7 + 8,
            delay: Math.random() * 8,
        });
    }
    return particles;
}

// ---- Particle count ----

const PARTICLE_COUNT: number = 25;

// ---- Page definition ----

Page({
    data: {
        roomId: '',
        roomCode: '',
        visibleTexts: [],
        dots: '',
        particles: [],
        isAnalyzing: true,
        showTimeout: false,
        showFinalText: false,
        showError: false,
        errorMessage: '',
        canRetry: false,
        titleAnimation: null,
        duckFloatAnimation: null,
        dogLeftAnimation: null,
        dogRightAnimation: null,
        collisionAnimation: null,
        shakeAnimation: null,
        cardAnimation: null,
        gearAnimation: null,
        textAnimations: [],
        particleAnimations: [],
    } as IVerdictWaitingData & {
        showError: boolean;
        errorMessage: string;
        canRetry: boolean;
    },

    // ---- Private properties (not in data, won't trigger render) ----
    _textPool: [] as string[],
    _currentTextIndex: 0 as number,
    _nextTextId: 0 as number,
    _enterTime: 0 as number,
    _hasNavigated: false as boolean,

    // Timer references
    _dotsTimer: null as number | null,
    _textTimer: null as number | null,
    _timeoutTimer: null as number | null,
    _navigationTimer: null as number | null,
    _particleTimers: [] as number[],

    // Animation manager
    _animManager: null as ReturnType<typeof createAnimationManager> | null,

    // ---- Lifecycle ----

    onLoad(options: Record<string, string | undefined>): void {
        const roomId: string = options.roomId ?? '';
        const roomCode: string = options.roomCode ?? '';

        // Generate particles
        const particles: IParticle[] = generateParticles(PARTICLE_COUNT);
        const particleAnimations: WechatMiniprogram.AnimationExportResult[] =
            new Array<WechatMiniprogram.AnimationExportResult>(
                PARTICLE_COUNT
            ).fill(null as unknown as WechatMiniprogram.AnimationExportResult);

        // Randomly pick text pool
        const shuffled: string[] = shuffleArray(LOADING_TEXTS);
        this._textPool = shuffled.slice(0, TEXT_POOL_SIZE);
        this._currentTextIndex = 0;
        this._nextTextId = 0;
        this._enterTime = Date.now();
        this._hasNavigated = false;

        this.setData({
            roomId,
            roomCode,
            particles,
            particleAnimations,
        });

        // Start WebSocket listening for verdict
        this._startVerdictListening();

        // Start all animations
        this._animManager = createAnimationManager();
        this._animManager.startAll((d: Record<string, unknown>): void => {
            if (!this.data.isAnalyzing) return;
            this.setData(d);
        });

        // Start particle animations
        this._startParticleAnimations();

        // Start dots animation
        this._startDotsAnimation();

        // Start text rotation
        this._startTextRotation();

        // Start timeout timer
        this._startTimeoutTimer();
    },

    onUnload(): void {
        this._cleanup();
    },

    onHide(): void {
        this._pauseAll();
    },

    onShow(): void {
        // Guard: skip if timers are already running (e.g. first
        // onShow right after onLoad which already started everything)
        if (
            this.data.isAnalyzing &&
            !this.data.showTimeout &&
            !this.data.showError &&
            this._dotsTimer === null
        ) {
            this._resumeAll();
        }
    },

    // ---- WebSocket listening ----

    _startVerdictListening(): void {
        verdictService.startListening({
            onResult: (result: IVerdictResult) => {
                this._handleVerdictResult(result);
            },
            onError: (payload: IVerdictFailedPayload) => {
                this._handleVerdictError(payload);
            },
        });

        logger.log('VerdictWaiting', 'WebSocket listening started');
    },

    /**
     * Handle VERDICT_RESULT
     * Cache result, show final text, then navigate to verdict page
     */
    _handleVerdictResult(result: IVerdictResult): void {
        if (this._hasNavigated) return;

        logger.log('VerdictWaiting', 'Verdict result received');

        // Clear timeout timer
        if (this._timeoutTimer !== null) {
            clearTimeout(this._timeoutTimer);
            this._timeoutTimer = null;
        }

        // Result is already cached by verdictService
        // Show "判决已出" text
        this.setData({ showFinalText: true });

        // Ensure minimum display time before navigating
        const elapsed: number = Date.now() - this._enterTime;
        const remainingMin: number = Math.max(0, MIN_DISPLAY_MS - elapsed);
        const navDelay: number = Math.max(FINAL_TEXT_DELAY_MS, remainingMin);

        this._navigationTimer = setTimeout((): void => {
            this._navigateToVerdict(result);
        }, navDelay) as unknown as number;
    },

    /**
     * Handle VERDICT_FAILED
     * Stop animations and show error overlay
     */
    _handleVerdictError(payload: IVerdictFailedPayload): void {
        if (this._hasNavigated) return;

        logger.warn('VerdictWaiting', 'Verdict failed:', payload.error);

        // Clear timeout timer
        if (this._timeoutTimer !== null) {
            clearTimeout(this._timeoutTimer);
            this._timeoutTimer = null;
        }

        this._stopAnimationsAndTimers();
        this.setData({
            isAnalyzing: false,
            showError: true,
            errorMessage: payload.error || '判决生成失败',
            canRetry: payload.canRetry,
        });
    },

    /**
     * Navigate to verdict page
     */
    _navigateToVerdict(_result: IVerdictResult): void {
        if (this._hasNavigated) return;
        this._hasNavigated = true;

        this._cleanup();

        void wx.redirectTo({
            url: '/packageB/pages/verdict/index',
        });
    },

    // ---- Dots animation ----

    _startDotsAnimation(): void {
        let step: number = 0;
        const states: string[] = ['.', '..', '...', '...'];

        this._dotsTimer = setInterval((): void => {
            this.setData({
                dots: states[step % 4],
            });
            step++;
        }, DOTS_INTERVAL_MS) as unknown as number;
    },

    // ---- Particle animations ----

    _startParticleAnimations(): void {
        const setData: (d: Record<string, unknown>) => void = (
            d: Record<string, unknown>
        ): void => {
            this.setData(d);
        };

        this.data.particles.forEach((p: IParticle, idx: number): void => {
            const delayTimer: number = setTimeout((): void => {
                const timer: number = createParticleRiseAnimation(
                    {
                        index: idx,
                        duration: p.duration,
                    },
                    setData
                );
                this._particleTimers.push(timer);
            }, p.delay * 1000) as unknown as number;
            this._particleTimers.push(delayTimer);
        });
    },

    // ---- Text rotation ----

    _startTextRotation(): void {
        this._addNextText();
        this._textTimer = setInterval((): void => {
            this._addNextText();
        }, TEXT_INTERVAL_MS) as unknown as number;
    },

    _addNextText(): void {
        if (!this.data.isAnalyzing) return;

        const idx: number = this._currentTextIndex % this._textPool.length;
        const rawText: string = this._textPool[idx];
        const newItem: ILoadingText = {
            id: this._nextTextId,
            text: rawText.replace(/\.{2,}$/, ''),
        };

        // Fade-in animation: CSS sets opacity:0, animation
        // gradually reveals the item
        const initAnim: WechatMiniprogram.Animation = wx.createAnimation({
            duration: 0,
        });
        initAnim.translateX(-100).opacity(0).step();

        // Prepend: newest item at top, old items pushed down
        let updated: ILoadingText[] = [...this.data.visibleTexts, newItem];
        let animations: WechatMiniprogram.AnimationExportResult[] = [
            ...this.data.textAnimations,
            initAnim.export(),
        ];

        if (updated.length > MAX_VISIBLE_TEXTS) {
            updated = updated.slice(updated.length - MAX_VISIBLE_TEXTS);
            animations = animations.slice(
                animations.length - MAX_VISIBLE_TEXTS
            );
        }

        this._currentTextIndex++;
        this._nextTextId++;

        this.setData({
            visibleTexts: updated,
            textAnimations: animations,
        });

        wx.nextTick(() => {
            if (!this.data.isAnalyzing) return;

            const entryAnim = wx.createAnimation({
                duration: 600,
                timingFunction: 'ease-out',
            });
            entryAnim.translateX(0).opacity(1).step();

            const nextAnimations = [...this.data.textAnimations];
            const lastIdx = nextAnimations.length - 1;
            if (lastIdx >= 0) nextAnimations[lastIdx] = entryAnim.export();

            this.setData({ textAnimations: nextAnimations });
        });
    },

    // ---- Timeout handling ----

    _startTimeoutTimer(): void {
        this._timeoutTimer = setTimeout((): void => {
            if (this.data.isAnalyzing && !this._hasNavigated) {
                this._stopAnimationsAndTimers();
                this.setData({
                    isAnalyzing: false,
                    showTimeout: true,
                });
            }
        }, ANALYSIS_TIMEOUT_MS) as unknown as number;
    },

    _stopAnimationsAndTimers(): void {
        if (this._dotsTimer !== null) {
            clearInterval(this._dotsTimer);
            this._dotsTimer = null;
        }
        if (this._textTimer !== null) {
            clearInterval(this._textTimer);
            this._textTimer = null;
        }
        if (this._timeoutTimer !== null) {
            clearTimeout(this._timeoutTimer);
            this._timeoutTimer = null;
        }
        if (this._navigationTimer !== null) {
            clearTimeout(this._navigationTimer);
            this._navigationTimer = null;
        }
        (this._particleTimers ?? []).forEach((t: number): void => {
            clearInterval(t);
            clearTimeout(t);
        });
        this._particleTimers = [];
        this._animManager?.stopAll();

        // Reset all animations to neutral so nothing keeps
        // moving behind the overlay
        const reset: WechatMiniprogram.Animation = wx.createAnimation({
            duration: 0,
        });
        reset.translateX(0).step();
        const neutralTranslate: WechatMiniprogram.AnimationExportResult =
            reset.export();

        const resetIdentity: WechatMiniprogram.Animation = wx.createAnimation({
            duration: 0,
        });
        resetIdentity.translateX(0).scaleX(1).scaleY(1).step();
        const neutralIdentity: WechatMiniprogram.AnimationExportResult =
            resetIdentity.export();

        const resetCollision: WechatMiniprogram.Animation = wx.createAnimation({
            duration: 0,
        });
        resetCollision.scale(0).opacity(0).step();

        this.setData({
            shakeAnimation: neutralTranslate,
            dogLeftAnimation: neutralIdentity,
            dogRightAnimation: neutralIdentity,
            collisionAnimation: resetCollision.export(),
        });
    },

    _cleanup(): void {
        this._stopAnimationsAndTimers();
    },

    _pauseAll(): void {
        this._stopAnimationsAndTimers();
    },

    _resumeAll(): void {
        this._animManager = createAnimationManager();
        this._animManager.startAll((d: Record<string, unknown>): void => {
            if (!this.data.isAnalyzing) return;
            this.setData(d);
        });
        this._startParticleAnimations();
        this._startDotsAnimation();
        this._startTextRotation();
    },

    // ---- Event handlers ----

    onTapBack(): void {
        wx.showModal({
            title: '提示',
            content: '审判正在进行中，确定离开吗？' + '离开将判定为弃权！',
            confirmText: '确定离开',
            cancelText: '继续等待',
            success: (
                res: WechatMiniprogram.ShowModalSuccessCallbackResult
            ): void => {
                if (res.confirm) {
                    this._cleanup();
                    verdictService.clear();
                    void wx.redirectTo({
                        url: '/pages/welcome/index',
                    });
                }
            },
        });
    },

    /**
     * Retry: send VERDICT_RETRY via WebSocket and restart listening
     */
    onTapRetry(): void {
        const { roomId } = this.data;
        const userId: string = getApp<IAppOption>().globalData.selfUserId;

        if (!roomId || !userId) {
            logger.warn(
                'VerdictWaiting',
                'Cannot retry: missing roomId or userId'
            );
            this._cleanup();
            void wx.redirectTo({ url: '/pages/welcome/index' });
            return;
        }

        // Reset UI state
        this._enterTime = Date.now();
        this.setData({
            isAnalyzing: true,
            showTimeout: false,
            showError: false,
            showFinalText: false,
            errorMessage: '',
            canRetry: false,
        });

        // Send VERDICT_RETRY
        wsManager.send({
            type: EWSMessageType.VerdictRetry,
            data: { roomId, userId },
            timestamp: Date.now(),
        });

        logger.log('VerdictWaiting', 'Sent VERDICT_RETRY');

        // Restart animations and listening
        this._startVerdictListening();
        this._resumeAll();
        this._startTimeoutTimer();
    },

    onTapHome(): void {
        this._cleanup();
        verdictService.clear();
        void wx.redirectTo({ url: '/pages/welcome/index' });
    },
});
