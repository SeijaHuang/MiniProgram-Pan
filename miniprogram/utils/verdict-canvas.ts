/**
 * Verdict Canvas Utility
 * Generates a verdict certificate image on a Canvas element
 *
 * Usage: Call generateVerdictImage(canvas, verdict) to draw
 * the verdict onto a 750x1334 canvas, then use
 * canvasToTempFilePath to get a file path for saving.
 */

import type { IVerdictResult } from '../types/verdict';

/** Canvas logical dimensions */
const CANVAS_WIDTH: number = 750;
const CANVAS_HEIGHT: number = 1334;

/** Colors */
const RED: string = '#D4380D';
const YELLOW: string = '#FFD93D';
const WHITE_ALPHA: string = 'rgba(255,255,255,0.8)';
const BG: string = '#FFFEF7';
const TEXT_DARK: string = '#333333';
const TEXT_GRAY: string = '#999999';
const TEXT_LIGHT: string = '#CCCCCC';

/**
 * Draw wrapped text centered on canvas
 * Returns the final y position after drawing
 */
function drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    centerX: number,
    startY: number,
    maxWidth: number,
    lineHeight: number
): number {
    let y: number = startY;
    const chars: string[] = [...text];
    let line: string = '';

    for (const char of chars) {
        const testLine: string = line + char;
        const metrics: TextMetrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line) {
            ctx.fillText(line, centerX, y);
            line = char;
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    if (line) {
        ctx.fillText(line, centerX, y);
    }
    return y;
}

/**
 * Generate a verdict certificate image on the given canvas
 *
 * @param canvas - WeChat Canvas node (type="2d")
 * @param verdict - The verdict data to render
 * @returns Promise that resolves when drawing is complete
 */
export function generateVerdictImage(
    canvas: WechatMiniprogram.Canvas,
    verdict: IVerdictResult
): void {
    const dpr: number = 2;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;

    const ctx: CanvasRenderingContext2D = canvas.getContext(
        '2d'
    ) as CanvasRenderingContext2D;
    ctx.scale(dpr, dpr);

    const w: number = CANVAS_WIDTH;
    const h: number = CANVAS_HEIGHT;

    // 1. Background + border
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = RED;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // 2. Header area
    ctx.fillStyle = RED;
    ctx.fillRect(0, 0, w, 200);

    ctx.fillStyle = YELLOW;
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('清汤大老爷判决书', w / 2, 100);

    ctx.fillStyle = WHITE_ALPHA;
    ctx.font = '24px sans-serif';
    ctx.fillText(`案件编号: NO.${verdict.caseNumber}`, w / 2, 160);

    // 3. Responsibility
    let y: number = 260;
    ctx.fillStyle = RED;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('责任分布', w / 2, y);

    y += 60;
    ctx.font = 'bold 48px sans-serif';
    ctx.fillStyle = TEXT_DARK;
    ctx.textAlign = 'left';
    ctx.fillText(`玩家1: ${verdict.responsibility.host}%`, 80, y);
    ctx.textAlign = 'right';
    ctx.fillText(`玩家2: ${verdict.responsibility.guest}%`, w - 80, y);

    // Third party factors
    y += 50;
    ctx.font = '24px sans-serif';
    ctx.fillStyle = TEXT_GRAY;
    ctx.textAlign = 'center';
    const factorLine: string = verdict.responsibility.thirdParty
        .map(f => `${f.emoji}${f.reason} ${f.percentage}%`)
        .join('  ');
    ctx.fillText(factorLine, w / 2, y);

    // 4. Battle Stats Summary
    y += 80;
    ctx.fillStyle = RED;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('六维战力图', w / 2, y);

    y += 50;
    ctx.font = '24px sans-serif';
    ctx.fillStyle = TEXT_DARK;
    ctx.textAlign = 'center';
    ctx.fillText('(详见小程序内雷达图)', w / 2, y);

    // 5. Verdict summary
    y += 80;
    ctx.fillStyle = RED;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('大老爷赠言', w / 2, y);

    y += 50;
    ctx.fillStyle = TEXT_DARK;
    ctx.font = '28px sans-serif';
    y = drawWrappedText(
        ctx,
        `"${verdict.verdictSummary}"`,
        w / 2,
        y,
        w - 160,
        40
    );

    // 6. Punishment
    y += 80;
    ctx.fillStyle = RED;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('惩罚令牌', w / 2, y);

    y += 50;
    ctx.fillStyle = TEXT_DARK;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(verdict.punishmentTask.task, w / 2, y);

    y += 40;
    ctx.fillStyle = TEXT_GRAY;
    ctx.font = '24px sans-serif';
    ctx.fillText(verdict.punishmentTask.deadline, w / 2, y);

    // 7. Footer
    ctx.fillStyle = TEXT_LIGHT;
    ctx.font = '20px sans-serif';
    ctx.fillText('清汤大老爷 · 判决书', w / 2, h - 60);
    const dateStr: string = new Date().toLocaleDateString('zh-CN');
    ctx.fillText(dateStr, w / 2, h - 30);
}
