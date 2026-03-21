/**
 * Verdict Page
 * 判决书页面 — 展示 AI 判决结果 + 赛后互动
 */

import { postGameService } from '../../../services/post-game-service';
import { verdictService } from '../../../services/verdict-service';
import { wsManager } from '../../../services/websocket-manager';
import type {
    IVerdictResult,
    IDimensionScores,
    ISecretReport,
    IPostGameEffectPayload,
} from '../../../types/verdict';
import { DIMENSION_LABELS, DIMENSION_KEYS } from '../../../types/verdict';
import { EWSMessageType } from '../../../types/websocket-common';
import { logger } from '../../../utils/logger';

type AnimResult = WechatMiniprogram.AnimationExportResult;

/** Subset of Canvas 2D context methods used by this page */
interface ICanvas2DContext {
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    font: string;
    textAlign: string;
    scale(x: number, y: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    strokeRect(x: number, y: number, w: number, h: number): void;
    fillText(text: string, x: number, y: number): void;
    measureText(text: string): { width: number };
}

/** Fields callback result for canvas node query */
interface ICanvasNodeResult {
    node: WechatMiniprogram.Canvas | null;
}

/** Animation timing constants (ms) */
const TIMING = {
    HEADER_DELAY: 0,
    HEADER_DURATION: 600,
    SECTION2_DELAY: 600,
    SECTION_STAGGER: 150,
    SECTION_DURATION: 400,
    PERCENT_ANIM_DELAY: 1000,
    PERCENT_ANIM_DURATION: 500,
    PERCENT_ANIM_INTERVAL: 16,
    RADAR_DELAY: 1200,
    SUMMARY_DELAY: 2000,
    SUMMARY_CHAR_INTERVAL: 50,
    STAMP_DELAY: 2800,
    STAMP_DURATION: 300,
    BUTTONS_DELAY: 3100,
    BUTTONS_STAGGER: 150,
    ACTION_COOLDOWN: 3000,
    EFFECT_CLEAR_DELAY: 2000,
} as const;

interface IEffectQueueItem {
    effect: 'stamp_death' | 'beg_emoji';
    fromUserId: string;
}

interface IVerdictPageData {
    loading: boolean;
    verdict: IVerdictResult | null;
    isWinner: boolean;
    isDraw: boolean;
    showSecretModal: boolean;
    actionRemainingCount: number;
    actionCooldown: boolean;
    headerAnimation: AnimResult;
    section2Animation: AnimResult;
    section3Animation: AnimResult;
    section4Animation: AnimResult;
    section5Animation: AnimResult;
    section6Animation: AnimResult;

    section8Animation: AnimResult;
    hostPercentDisplay: number;
    guestPercentDisplay: number;
    summaryDisplayText: string;
    saving: boolean;
    mySecretReport: ISecretReport;
    myTopDimension: string;
    myTopScore: number;
    // 双方昵称
    hostNickName: string;
    guestNickName: string;
    // Radar chart scores (derived from verdict.radarChart by userId)
    hostRadarScores: IDimensionScores;
    guestRadarScores: IDimensionScores;
    // Effect queue fields
    effectQueue: IEffectQueueItem[];
    isPlayingEffect: boolean;
    showEffectOverlay: boolean;
    currentEffectType: 'stamp_death' | 'beg_emoji' | '';
}

Page({
    data: {
        loading: true,
        verdict: null,
        isWinner: false,
        isDraw: false,
        showSecretModal: false,
        actionRemainingCount: 5,
        actionCooldown: false,
        headerAnimation: {} as AnimResult,
        section2Animation: {} as AnimResult,
        section3Animation: {} as AnimResult,
        section4Animation: {} as AnimResult,
        section5Animation: {} as AnimResult,
        section6Animation: {} as AnimResult,

        section8Animation: {} as AnimResult,
        hostPercentDisplay: 0,
        guestPercentDisplay: 0,
        summaryDisplayText: '',
        saving: false,
        mySecretReport: { userId: '', title: '', advice: '' },
        myTopDimension: '',
        myTopScore: 0,
        hostNickName: '玩家1',
        guestNickName: '玩家2',
        hostRadarScores: {
            mouthHard: 0,
            oldAccountDigging: 0,
            logicSlippery: 0,
            charmAttack: 0,
            survivalInstinct: 0,
            victimActing: 0,
        },
        guestRadarScores: {
            mouthHard: 0,
            oldAccountDigging: 0,
            logicSlippery: 0,
            charmAttack: 0,
            survivalInstinct: 0,
            victimActing: 0,
        },
        effectQueue: [] as IEffectQueueItem[],
        isPlayingEffect: false,
        showEffectOverlay: false,
        currentEffectType: '' as 'stamp_death' | 'beg_emoji' | '',
    } as IVerdictPageData,

    // Timer references (not in data)
    _percentTimer: null as number | null,
    _summaryTimer: null as number | null,
    _cooldownTimer: null as number | null,
    _effectPlayTimer: null as number | null,
    _effectGapTimer: null as number | null,
    _animTimers: [] as number[],
    _roomId: '' as string,

    onLoad(_options): void {
        this._roomId = getApp<IAppOption>().globalData.roomId;

        // Try to get verdict from service cache
        const verdict: IVerdictResult | null = verdictService.getResult();

        if (verdict) {
            this.initWithVerdict(verdict);
        } else {
            // Fallback: fetch via HTTP
            this.setData({ loading: true });
            verdictService
                .fetchVerdict(this._roomId)
                .then((result: IVerdictResult) => {
                    this.initWithVerdict(result);
                })
                .catch((error: Error) => {
                    logger.error('Verdict', 'Failed to load:', error);
                    void wx.showToast({
                        title: '加载判决书失败',
                        icon: 'none',
                    });
                });
        }

        // Setup post-game service with queue-based effect handling
        postGameService.initialize();
        postGameService.onEffect((payload: IPostGameEffectPayload) => {
            const queue: IEffectQueueItem[] = [
                ...this.data.effectQueue,
                {
                    effect: payload.effect,
                    fromUserId: payload.fromUserId,
                },
            ];
            this.setData({ effectQueue: queue });
            if (!this.data.isPlayingEffect) {
                this._playNextEffect();
            }
        });
    },

    onReady(): void {
        // Radar chart will be drawn after animation delay
        if (this.data.verdict) {
            setTimeout(() => {
                const radarChart = this.selectComponent('#radarChart');
                if (radarChart) {
                    (radarChart as Record<string, () => void>).draw();
                }
            }, TIMING.RADAR_DELAY);
        }
    },

    onUnload(): void {
        this.clearAllTimers();
        postGameService.destroy();
    },

    /**
     * Initialize page with verdict data
     */
    initWithVerdict(verdict: IVerdictResult): void {
        const app = getApp<IAppOption>();
        const { selfUserId, hostUserId } = app.globalData;

        const isWinner: boolean = verdict.winnerId === selfUserId;
        const isDraw: boolean =
            verdict.winnerId === null || verdict.winnerId === verdict.loserId;

        // Find self's secret report
        const mySecretReport: ISecretReport = verdict.secretReports.find(
            r => r.userId === selfUserId
        ) ?? { userId: selfUserId, title: '', advice: '' };

        // Find self's radar scores
        const selfStats = verdict.radarChart.find(p => p.userId === selfUserId);
        const myScores: IDimensionScores = selfStats?.scores ?? {
            mouthHard: 0,
            oldAccountDigging: 0,
            logicSlippery: 0,
            charmAttack: 0,
            survivalInstinct: 0,
            victimActing: 0,
        };

        // Find top dimension
        let topKey: keyof IDimensionScores = 'mouthHard';
        let topVal: number = 0;
        for (const key of DIMENSION_KEYS) {
            if (myScores[key] > topVal) {
                topVal = myScores[key];
                topKey = key;
            }
        }

        // Derive nicknames from responsibility players
        const hostPlayer = verdict.responsibility.players.find(
            p => p.userId === hostUserId
        );
        const guestPlayer = verdict.responsibility.players.find(
            p => p.userId !== hostUserId
        );
        const hostNickName: string = hostPlayer?.nickname || '玩家1';
        const guestNickName: string = guestPlayer?.nickname || '玩家2';

        // Derive radar scores for host/guest
        const emptyScores: IDimensionScores = {
            mouthHard: 0,
            oldAccountDigging: 0,
            logicSlippery: 0,
            charmAttack: 0,
            survivalInstinct: 0,
            victimActing: 0,
        };
        const hostRadarEntry = verdict.radarChart.find(
            p => p.userId === hostUserId
        );
        const guestRadarEntry = verdict.radarChart.find(
            p => p.userId !== hostUserId
        );
        const hostRadarScores: IDimensionScores =
            hostRadarEntry?.scores ?? emptyScores;
        const guestRadarScores: IDimensionScores =
            guestRadarEntry?.scores ?? emptyScores;

        this.setData({
            loading: false,
            verdict,
            isWinner,
            isDraw,
            mySecretReport,
            myTopDimension: DIMENSION_LABELS[topKey],
            myTopScore: topVal,
            hostNickName,
            guestNickName,
            hostRadarScores,
            guestRadarScores,
        });

        // Start entrance animations
        this.startAnimationSequence(verdict);
    },

    /**
     * Orchestrate entrance animation sequence
     */
    startAnimationSequence(verdict: IVerdictResult): void {
        // Header: fade in + translate
        this.scheduleAnim(TIMING.HEADER_DELAY, () => {
            const anim: WechatMiniprogram.Animation = wx.createAnimation({
                duration: TIMING.HEADER_DURATION,
                timingFunction: 'ease-out',
            });
            anim.opacity(1).step();
            this.setData({ headerAnimation: anim.export() });
        });

        // Section 2-5: staggered entry
        const sections: string[] = [
            'section2Animation',
            'section3Animation',
            'section4Animation',
            'section5Animation',
        ];

        sections.forEach((key: string, idx: number): void => {
            const delay: number =
                TIMING.SECTION2_DELAY + idx * TIMING.SECTION_STAGGER;
            this.scheduleAnim(delay, () => {
                const anim: WechatMiniprogram.Animation = wx.createAnimation({
                    duration: TIMING.SECTION_DURATION,
                    timingFunction: 'ease-out',
                });
                anim.opacity(1).step();
                const update: Record<string, AnimResult> = {};
                update[key] = anim.export();
                this.setData(update);
            });
        });

        // Percent count-up animation
        this.scheduleAnim(TIMING.PERCENT_ANIM_DELAY, () => {
            this.animatePercents(verdict);
        });

        // Summary typewriter
        this.scheduleAnim(TIMING.SUMMARY_DELAY, () => {
            this.animateSummary(verdict.verdictSummary);
        });

        // Stamp effect on punishment section
        this.scheduleAnim(TIMING.STAMP_DELAY, () => {
            wx.vibrateLong({
                fail: () => {
                    // ignore
                },
            });
        });

        // Bottom buttons (section7 merged into section6)
        const btnSections: string[] = [
            'section6Animation',
            'section8Animation',
        ];
        btnSections.forEach((key: string, idx: number): void => {
            const delay: number =
                TIMING.BUTTONS_DELAY + idx * TIMING.BUTTONS_STAGGER;
            this.scheduleAnim(delay, () => {
                const anim: WechatMiniprogram.Animation = wx.createAnimation({
                    duration: TIMING.SECTION_DURATION,
                    timingFunction: 'ease-out',
                });
                anim.opacity(1).step();
                const update: Record<string, AnimResult> = {};
                update[key] = anim.export();
                this.setData(update);
            });
        });
    },

    /**
     * Schedule an animation callback
     */
    scheduleAnim(delay: number, callback: () => void): void {
        const timer: number = setTimeout(callback, delay) as unknown as number;
        this._animTimers.push(timer);
    },

    /**
     * Animate percent numbers from 0 to target
     */
    animatePercents(verdict: IVerdictResult): void {
        const hostUserId = getApp<IAppOption>().globalData.hostUserId;
        const hostPlayer = verdict.responsibility.players.find(
            p => p.userId === hostUserId
        );
        const guestPlayer = verdict.responsibility.players.find(
            p => p.userId !== hostUserId
        );
        const targetHost: number = hostPlayer?.percentage ?? 0;
        const targetGuest: number = guestPlayer?.percentage ?? 0;
        const steps: number = Math.ceil(
            TIMING.PERCENT_ANIM_DURATION / TIMING.PERCENT_ANIM_INTERVAL
        );
        let step: number = 0;

        this._percentTimer = setInterval(() => {
            step++;
            const progress: number = Math.min(step / steps, 1);
            this.setData({
                hostPercentDisplay: Math.round(targetHost * progress),
                guestPercentDisplay: Math.round(targetGuest * progress),
            });
            if (progress >= 1 && this._percentTimer !== null) {
                clearInterval(this._percentTimer);
                this._percentTimer = null;
            }
        }, TIMING.PERCENT_ANIM_INTERVAL) as unknown as number;
    },

    /**
     * Typewriter effect for summary text
     */
    animateSummary(fullText: string): void {
        let idx: number = 0;
        this._summaryTimer = setInterval(() => {
            idx++;
            this.setData({
                summaryDisplayText: fullText.slice(0, idx),
            });
            if (idx >= fullText.length && this._summaryTimer !== null) {
                clearInterval(this._summaryTimer);
                this._summaryTimer = null;
            }
        }, TIMING.SUMMARY_CHAR_INTERVAL) as unknown as number;
    },

    /**
     * Clear all timers
     */
    clearAllTimers(): void {
        if (this._percentTimer !== null) {
            clearInterval(this._percentTimer);
            this._percentTimer = null;
        }
        if (this._summaryTimer !== null) {
            clearInterval(this._summaryTimer);
            this._summaryTimer = null;
        }
        if (this._cooldownTimer !== null) {
            clearTimeout(this._cooldownTimer);
            this._cooldownTimer = null;
        }
        if (this._effectPlayTimer !== null) {
            clearTimeout(this._effectPlayTimer);
            this._effectPlayTimer = null;
        }
        if (this._effectGapTimer !== null) {
            clearTimeout(this._effectGapTimer);
            this._effectGapTimer = null;
        }
        for (const t of this._animTimers) {
            clearTimeout(t);
        }
        this._animTimers = [];
    },

    // ---- Event Handlers ----

    onSecretModalOpen(): void {
        this.setData({ showSecretModal: true });
    },

    onSecretModalClose(): void {
        this.setData({ showSecretModal: false });
    },

    onSaveVerdict(): void {
        if (this.data.saving) return;
        this.setData({ saving: true });

        // Use canvas to generate image
        const query: WechatMiniprogram.SelectorQuery =
            this.createSelectorQuery();
        query
            .select('#verdictCanvas')
            .fields({ node: true, size: true }, res => {
                const result = res as ICanvasNodeResult;
                if (!result || !result.node) {
                    void wx.showToast({
                        title: '生成图片失败',
                        icon: 'none',
                    });
                    this.setData({ saving: false });
                    return;
                }

                this.drawVerdictToCanvas(result.node);
            })
            .exec();
    },

    /**
     * Draw verdict content to canvas and save
     */
    drawVerdictToCanvas(canvas: WechatMiniprogram.Canvas): void {
        const verdict: IVerdictResult | null = this.data.verdict;
        if (!verdict) {
            this.setData({ saving: false });
            return;
        }

        const width: number = 750;
        const height: number = 1334; // fixed screen height
        const dpr: number = 2;

        canvas.width = width * dpr;
        canvas.height = height * dpr;

        const ctx: ICanvas2DContext = canvas.getContext(
            '2d'
        ) as ICanvas2DContext;
        ctx.scale(dpr, dpr);

        // Layout constants
        const headerH: number = 200;
        const footerH: number = 60;
        const outerPadX: number = 40;
        const sectionW: number = width - outerPadX * 2;
        const innerPadX: number = 30;
        const innerPadY: number = 28;
        const textX: number = outerPadX + innerPadX;
        const textMaxW: number = sectionW - innerPadX * 2;

        // Word-wrap helper — modifies ctx.font as a side-effect
        const wrapText = (
            text: string,
            maxW: number,
            font: string
        ): string[] => {
            ctx.font = font;
            const lines: string[] = [];
            let line: string = '';
            for (const ch of [...text]) {
                const test: string = line + ch;
                if (ctx.measureText(test).width > maxW && line) {
                    lines.push(line);
                    line = ch;
                } else {
                    line = test;
                }
            }
            if (line) lines.push(line);
            return lines;
        };

        // Draw a full-width section panel with left accent bar
        const drawPanel = (panelY: number, panelH: number): void => {
            ctx.fillStyle = 'rgba(212, 56, 13, 0.06)';
            ctx.fillRect(outerPadX, panelY, sectionW, panelH);
            ctx.fillStyle = '#D4380D';
            ctx.fillRect(outerPadX, panelY, 6, panelH);
        };

        // ── Pre-calculate section heights ──────────────────────────────
        const { hostNickName, guestNickName } = this.data;
        const canvasHostUserId = getApp<IAppOption>().globalData.hostUserId;
        const canvasHostPlayer = verdict.responsibility.players.find(
            p => p.userId === canvasHostUserId
        );
        const canvasGuestPlayer = verdict.responsibility.players.find(
            p => p.userId !== canvasHostUserId
        );
        const hostRespPercent: number = canvasHostPlayer?.percentage ?? 0;
        const guestRespPercent: number = canvasGuestPlayer?.percentage ?? 0;
        const thirdPartyLines: string[] = verdict.responsibility.thirdParty.map(
            f => `${f.emoji}${f.reason}: ${f.percentage}%`
        );

        const respTitleH: number = 56;
        const respNameH: number = 64;
        const respThirdH: number = 44;
        const respPanelH: number =
            innerPadY * 2 +
            respTitleH +
            respNameH * 2 +
            respThirdH * thirdPartyLines.length;

        const summaryFont: string = '28px sans-serif';
        const summaryLines: string[] = wrapText(
            verdict.verdictSummary,
            textMaxW,
            summaryFont
        );
        const summaryLineH: number = 44;
        const summaryTitleH: number = 56;
        const summaryPanelH: number =
            innerPadY * 2 + summaryTitleH + summaryLines.length * summaryLineH;

        const punishFont: string = 'bold 30px sans-serif';
        const punishLines: string[] = wrapText(
            verdict.punishmentTask.task,
            textMaxW,
            punishFont
        );
        const punishLineH: number = 46;
        const punishTitleH: number = 56;
        const deadlineH: number = 44;
        const punishPanelH: number =
            innerPadY * 2 +
            punishTitleH +
            punishLines.length * punishLineH +
            deadlineH;

        // Distribute remaining space evenly as 4 gaps
        // (top gap + 2 between sections + bottom gap before footer)
        const totalSectionH: number = respPanelH + summaryPanelH + punishPanelH;
        const contentAvail: number = height - headerH - footerH;
        const gap: number = Math.max(
            20,
            Math.floor((contentAvail - totalSectionH) / 4)
        );

        // ── Draw ──────────────────────────────────────────────────────

        // Background
        ctx.fillStyle = '#FFFEF7';
        ctx.fillRect(0, 0, width, height);

        // Header
        ctx.fillStyle = '#D4380D';
        ctx.fillRect(0, 0, width, headerH);

        ctx.fillStyle = '#FFD93D';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('清汤大老爷判决书', width / 2, 100);

        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '24px sans-serif';
        ctx.fillText(`案件编号: NO.${verdict.caseNumber}`, width / 2, 160);

        let y: number = headerH + gap;

        // ===== 责任分布 =====
        drawPanel(y, respPanelH);

        let iy: number = y + innerPadY;

        ctx.fillStyle = '#D4380D';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('责任分布', width / 2, iy + 32);
        iy += respTitleH;

        ctx.fillStyle = '#333333';
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${hostNickName}: ${hostRespPercent}%`, textX, iy + 46);
        iy += respNameH;

        ctx.fillText(`${guestNickName}: ${guestRespPercent}%`, textX, iy + 46);
        iy += respNameH;

        ctx.fillStyle = '#666666';
        ctx.font = '26px sans-serif';
        for (const tpLine of thirdPartyLines) {
            ctx.fillText(tpLine, textX, iy + 30);
            iy += respThirdH;
        }

        y += respPanelH + gap;

        // ===== 大老爷赠言 =====
        drawPanel(y, summaryPanelH);
        iy = y + innerPadY;

        ctx.fillStyle = '#D4380D';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('大老爷赠言', width / 2, iy + 32);
        iy += summaryTitleH;

        ctx.fillStyle = '#333333';
        ctx.font = summaryFont;
        ctx.textAlign = 'left';
        for (const sLine of summaryLines) {
            ctx.fillText(sLine, textX, iy + 32);
            iy += summaryLineH;
        }

        y += summaryPanelH + gap;

        // ===== 惩罚令牌 =====
        drawPanel(y, punishPanelH);
        iy = y + innerPadY;

        ctx.fillStyle = '#D4380D';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('惩罚令牌', width / 2, iy + 32);
        iy += punishTitleH;

        ctx.fillStyle = '#333333';
        ctx.font = punishFont;
        ctx.textAlign = 'left';
        for (const pLine of punishLines) {
            ctx.fillText(pLine, textX, iy + 36);
            iy += punishLineH;
        }

        ctx.fillStyle = '#999999';
        ctx.font = '24px sans-serif';
        ctx.fillText(verdict.punishmentTask.deadline, textX, iy + 28);

        y += punishPanelH + gap;

        // Footer
        ctx.fillStyle = '#CCCCCC';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('清汤大老爷 · 判决书', width / 2, y + 20);
        const dateStr: string = new Date().toLocaleDateString('zh-CN');
        ctx.fillText(dateStr, width / 2, y + 44);

        // Border drawn last to frame full screen height
        ctx.strokeStyle = '#D4380D';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, width - 8, height - 8);

        // Save to album at fixed screen height
        wx.canvasToTempFilePath({
            canvas,
            x: 0,
            y: 0,
            width: width * dpr,
            height: height * dpr,
            destWidth: width * dpr,
            destHeight: height * dpr,
            fileType: 'png',
            success: (
                res: WechatMiniprogram.CanvasToTempFilePathSuccessCallbackResult
            ) => {
                wx.saveImageToPhotosAlbum({
                    filePath: res.tempFilePath,
                    success: () => {
                        void wx.showToast({
                            title: '已保存到相册',
                            icon: 'success',
                        });
                        this.setData({ saving: false });
                    },
                    fail: () => {
                        void wx.showToast({
                            title: '保存失败，请授权相册权限',
                            icon: 'none',
                        });
                        this.setData({ saving: false });
                    },
                });
            },
            fail: () => {
                void wx.showToast({
                    title: '生成图片失败',
                    icon: 'none',
                });
                this.setData({ saving: false });
            },
        });
    },

    /**
     * Unified post-game action handler (execute_punishment or beg_for_mercy)
     * Sends WS message; animation triggers when server broadcasts back.
     */
    onPostGameAction(e: WechatMiniprogram.TouchEvent): void {
        const action = e.currentTarget.dataset.action as
            | 'execute_punishment'
            | 'beg_for_mercy';
        if (this.data.actionCooldown || this.data.actionRemainingCount <= 0) {
            return;
        }

        const remaining: number = this.data.actionRemainingCount - 1;
        this.setData({
            actionRemainingCount: remaining,
            actionCooldown: true,
        });

        postGameService.sendAction(this._roomId, action, remaining);

        this._cooldownTimer = setTimeout(() => {
            this.setData({ actionCooldown: false });
            this._cooldownTimer = null;
        }, TIMING.ACTION_COOLDOWN) as unknown as number;
    },

    /**
     * Leave room immediately
     */
    onLeaveRoom(): void {
        wsManager.send({
            type: EWSMessageType.LeaveRoom,
            data: {
                roomId: this._roomId,
            },
            timestamp: Date.now(),
        });
        // Delay navigation to let WS message send before page teardown
        void wx.reLaunch({
            url: '/pages/welcome/index',
        });
    },

    /**
     * Play next effect from queue (serial playback)
     */
    _playNextEffect(): void {
        const queue: IEffectQueueItem[] = this.data.effectQueue;
        if (queue.length === 0) {
            this.setData({
                isPlayingEffect: false,
                showEffectOverlay: false,
                currentEffectType: '',
            });
            return;
        }

        const [current, ...rest] = queue;
        this.setData({
            effectQueue: rest,
            isPlayingEffect: true,
            showEffectOverlay: true,
            currentEffectType: current.effect,
        });

        // Hide after display duration, then play next after a gap
        this._effectPlayTimer = setTimeout(() => {
            this.setData({
                showEffectOverlay: false,
                currentEffectType: '',
            });
            this._effectGapTimer = setTimeout(() => {
                this._playNextEffect();
            }, 150) as unknown as number;
        }, TIMING.EFFECT_CLEAR_DELAY) as unknown as number;
    },
});
