// components/radar-chart/index.ts

import { DIMENSION_LABELS, DIMENSION_KEYS } from '../../types/verdict';
import type { IDimensionScores } from '../../types/verdict';

/** Subset of Canvas 2D context methods used by this component */
interface ICanvas2DContext {
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    font: string;
    textAlign: string;
    textBaseline: string;
    scale(x: number, y: number): void;
    clearRect(x: number, y: number, w: number, h: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    fillText(text: string, x: number, y: number): void;
    beginPath(): void;
    closePath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    stroke(): void;
    fill(): void;
    setLineDash(segments: number[]): void;
}

/** Fields callback result for canvas node query */
interface ICanvasNodeResult {
    node: WechatMiniprogram.Canvas | null;
    width: number;
    height: number;
}

/** Animation frame count for expand animation */
const ANIM_FRAMES: number = 30;
/** Animation duration in ms */
const ANIM_DURATION: number = 800;

/** Grid layer percentages */
const GRID_LAYERS: number[] = [25, 50, 75, 100];

/** Colors */
const HOST_STROKE: string = '#666666';
const HOST_FILL: string = 'rgba(102,102,102,0.25)';
const GUEST_STROKE: string = '#D4380D';
const GUEST_FILL: string = 'rgba(212,56,13,0.25)';
const GRID_COLOR: string = '#E8E8E8';
const AXIS_COLOR: string = '#CCCCCC';
const LABEL_COLOR: string = '#333333';

Component({
    properties: {
        hostScores: {
            type: Object,
            value: {} as IDimensionScores,
        },
        guestScores: {
            type: Object,
            value: {} as IDimensionScores,
        },
        size: {
            type: Number,
            value: 500,
        },
    },

    data: {
        canvasHeight: 560 as number,
        _canvas: null as WechatMiniprogram.Canvas | null,
        _ctx: null as ICanvas2DContext | null,
        _animTimer: null as number | null,
        _animFrame: 0 as number,
    },

    lifetimes: {
        attached(): void {
            const extra: number = 60;
            this.setData({
                canvasHeight: this.data.size + extra,
            });
        },

        detached(): void {
            if (this.data._animTimer !== null) {
                clearTimeout(this.data._animTimer);
                this.data._animTimer = null;
            }
        },
    },

    methods: {
        /**
         * Public method: draw the radar chart
         * Called by parent page after onReady
         */
        draw(): void {
            const query: WechatMiniprogram.SelectorQuery =
                this.createSelectorQuery();
            query
                .select('#radarCanvas')
                .fields({ node: true, size: true }, res => {
                    const result = res as ICanvasNodeResult;
                    if (!result || !result.node) {
                        console.error('[RadarChart] Canvas not found');
                        return;
                    }
                    const canvas: WechatMiniprogram.Canvas = result.node;
                    const ctx: ICanvas2DContext = canvas.getContext(
                        '2d'
                    ) as ICanvas2DContext;

                    const dpr: number = wx.getSystemInfoSync().pixelRatio;
                    canvas.width = result.width * dpr;
                    canvas.height = result.height * dpr;
                    ctx.scale(dpr, dpr);

                    this.data._canvas = canvas;
                    this.data._ctx = ctx;

                    this.startExpandAnimation(result.width, result.height);
                })
                .exec();
        },

        /**
         * Start expand animation (radius 0 → target)
         */
        startExpandAnimation(width: number, height: number): void {
            this.data._animFrame = 0;

            const animate = (): void => {
                this.data._animFrame++;
                const progress: number = Math.min(
                    this.data._animFrame / ANIM_FRAMES,
                    1
                );
                // Ease-out cubic
                const eased: number = 1 - Math.pow(1 - progress, 3);

                this.drawFrame(width, height, eased);

                if (progress < 1) {
                    this.data._animTimer = setTimeout(
                        animate,
                        ANIM_DURATION / ANIM_FRAMES
                    ) as unknown as number;
                }
            };

            animate();
        },

        /**
         * Draw a single frame of the radar chart
         */
        drawFrame(width: number, height: number, progress: number): void {
            const ctx: ICanvas2DContext | null = this.data._ctx;
            if (!ctx) return;

            const centerX: number = width / 2;
            const centerY: number = height / 2 - 5;
            const radius: number = Math.min(width, height) / 2 - 40;
            const sides: number = 6;
            const angleStep: number = (Math.PI * 2) / sides;
            const startAngle: number = -Math.PI / 2;

            // Clear
            ctx.clearRect(0, 0, width, height);

            // Draw grid layers (dashed)
            for (const pct of GRID_LAYERS) {
                const r: number = (radius * pct) / 100;
                ctx.beginPath();
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = GRID_COLOR;
                ctx.lineWidth = 1;
                for (let i: number = 0; i < sides; i++) {
                    const angle: number = startAngle + i * angleStep;
                    const x: number = centerX + r * Math.cos(angle);
                    const y: number = centerY + r * Math.sin(angle);
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
                ctx.stroke();
            }

            // Draw axis lines
            ctx.setLineDash([]);
            ctx.strokeStyle = AXIS_COLOR;
            ctx.lineWidth = 1;
            for (let i: number = 0; i < sides; i++) {
                const angle: number = startAngle + i * angleStep;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(
                    centerX + radius * Math.cos(angle),
                    centerY + radius * Math.sin(angle)
                );
                ctx.stroke();
            }

            // Draw labels
            ctx.font = '11px sans-serif';
            ctx.fillStyle = LABEL_COLOR;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const labelOffset: number = 28;
            for (let i: number = 0; i < sides; i++) {
                const angle: number = startAngle + i * angleStep;
                const key: keyof IDimensionScores = DIMENSION_KEYS[i];
                const label: string = DIMENSION_LABELS[key];
                const lx: number =
                    centerX + (radius + labelOffset) * Math.cos(angle);
                const ly: number =
                    centerY + (radius + labelOffset) * Math.sin(angle);
                ctx.fillText(label, lx, ly);
            }

            // Draw data areas with animation progress
            const hostScores: IDimensionScores = this.data
                .hostScores as IDimensionScores;
            const guestScores: IDimensionScores = this.data
                .guestScores as IDimensionScores;

            this.drawDataArea(
                ctx,
                centerX,
                centerY,
                radius,
                startAngle,
                angleStep,
                hostScores,
                HOST_STROKE,
                HOST_FILL,
                progress
            );

            this.drawDataArea(
                ctx,
                centerX,
                centerY,
                radius,
                startAngle,
                angleStep,
                guestScores,
                GUEST_STROKE,
                GUEST_FILL,
                progress
            );
        },

        /**
         * Draw one player's data area
         */
        drawDataArea(
            ctx: ICanvas2DContext,
            cx: number,
            cy: number,
            maxRadius: number,
            startAngle: number,
            angleStep: number,
            scores: IDimensionScores,
            strokeColor: string,
            fillColor: string,
            progress: number
        ): void {
            ctx.beginPath();
            ctx.setLineDash([]);

            for (let i: number = 0; i < 6; i++) {
                const key: keyof IDimensionScores = DIMENSION_KEYS[i];
                const value: number = scores[key] ?? 0;
                const r: number = ((maxRadius * value) / 100) * progress;
                const angle: number = startAngle + i * angleStep;
                const x: number = cx + r * Math.cos(angle);
                const y: number = cy + r * Math.sin(angle);

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.closePath();
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2;
            ctx.stroke();
        },
    },
});
