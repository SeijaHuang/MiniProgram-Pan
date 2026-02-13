/**
 * Verdict Waiting Page Animation Manager
 * All animations via wx.createAnimation() — CSS animation/transition FORBIDDEN
 */

// ---- Types ----

/** setData callback, passed in by page instance */
type SetDataFn = (data: Record<string, unknown>) => void;

interface IAnimationManager {
    startAll(setData: SetDataFn): void;
    stopAll(): void;
}

// ---- Particle config ----

interface IParticleAnimConfig {
    index: number;
    duration: number;
}

// ---- Particle rise animation ----

function createParticleRiseAnimation(
    config: IParticleAnimConfig,
    setData: SetDataFn
): number {
    const { index, duration } = config;
    const durationMs: number = duration * 1000;

    const runCycle = (): void => {
        const anim: WechatMiniprogram.Animation = wx.createAnimation({
            duration: durationMs,
            timingFunction: 'linear',
        });
        const swayX: number = (Math.random() - 0.5) * 20;
        anim.translateY(-110).translateX(swayX).opacity(0).step();

        anim.translateY(0).translateX(0).opacity(0).step({ duration: 0 });

        anim.opacity(1).step({ duration: 300 });

        const key: string = `particleAnimations[${index}]`;
        setData({ [key]: anim.export() });
    };

    runCycle();
    const timer: number = setInterval(
        runCycle,
        durationMs + 300
    ) as unknown as number;
    return timer;
}

// ---- Title breath animation ----

function createTitleBreathAnimation(setData: SetDataFn): number {
    let phase: number = 0;

    const runCycle = (): void => {
        const anim: WechatMiniprogram.Animation = wx.createAnimation({
            duration: 1000,
            timingFunction: 'ease-in-out',
        });

        if (phase % 2 === 0) {
            anim.scale(1.03).step();
        } else {
            anim.scale(1.0).step();
        }
        phase++;
        setData({ titleAnimation: anim.export() });
    };

    runCycle();
    const timer: number = setInterval(runCycle, 1000) as unknown as number;
    return timer;
}

// ---- Duck float animation ----

function createDuckFloatAnimation(setData: SetDataFn): number {
    let phase: number = 0;

    const runCycle = (): void => {
        const anim: WechatMiniprogram.Animation = wx.createAnimation({
            duration: 1500,
            timingFunction: 'ease-in-out',
        });

        if (phase % 2 === 0) {
            anim.translateY(-15).step();
        } else {
            anim.translateY(0).step();
        }
        phase++;
        setData({ duckFloatAnimation: anim.export() });
    };

    runCycle();
    const timer: number = setInterval(runCycle, 1500) as unknown as number;
    return timer;
}

// ---- Dog collision animation (core) ----

/**
 * Dog collision animation — single cycle 2400ms
 * Timeline:
 *   0-480ms     蓄力后退
 *   480-840ms   冲刺到中心
 *   840-960ms   碰撞压扁
 *   960-1200ms  弹开过冲
 *   1200-1800ms 回弹归位
 *   1800-2400ms 停顿喘息
 */
interface IDogCollisionResult {
    intervalTimer: number;
    /** Pending collision-hit setTimeout IDs (cleared on stop) */
    hitTimers: number[];
}

function createDogCollisionAnimation(
    setData: SetDataFn,
    onCollisionHit: () => void
): IDogCollisionResult {
    const CYCLE: number = 2400;
    const hitTimers: number[] = [];

    const runCycle = (): void => {
        // Left dog
        const leftAnim: WechatMiniprogram.Animation = wx.createAnimation({
            duration: 0,
            timingFunction: 'ease-in-out',
        });

        leftAnim.translateX(-10).step({ duration: 480 });
        leftAnim
            .translateX(50)
            .step({ duration: 360, timingFunction: 'ease-in' });
        leftAnim.translateX(45).scaleX(1.2).scaleY(0.8).step({ duration: 120 });
        leftAnim
            .translateX(-15)
            .scaleX(0.9)
            .scaleY(1.1)
            .step({ duration: 240 });
        leftAnim.translateX(5).scaleX(1).scaleY(1).step({ duration: 300 });
        leftAnim.translateX(0).step({ duration: 300 });
        leftAnim.translateX(2).step({ duration: 300 });
        leftAnim.translateX(0).step({ duration: 300 });

        // Right dog (mirrored)
        const rightAnim: WechatMiniprogram.Animation = wx.createAnimation({
            duration: 0,
            timingFunction: 'ease-in-out',
        });

        rightAnim.translateX(10).step({ duration: 480 });
        rightAnim
            .translateX(-50)
            .step({ duration: 360, timingFunction: 'ease-in' });
        rightAnim
            .translateX(-45)
            .scaleX(1.2)
            .scaleY(0.8)
            .step({ duration: 120 });
        rightAnim
            .translateX(15)
            .scaleX(0.9)
            .scaleY(1.1)
            .step({ duration: 240 });
        rightAnim.translateX(-5).scaleX(1).scaleY(1).step({ duration: 300 });
        rightAnim.translateX(0).step({ duration: 300 });
        rightAnim.translateX(-2).step({ duration: 300 });
        rightAnim.translateX(0).step({ duration: 300 });

        setData({
            dogLeftAnimation: leftAnim.export(),
            dogRightAnimation: rightAnim.export(),
        });

        // Collision hit callback at 840ms (tracked for cleanup)
        const hitTimer: number = setTimeout((): void => {
            onCollisionHit();
        }, 840) as unknown as number;
        hitTimers.push(hitTimer);
    };

    runCycle();
    const intervalTimer: number = setInterval(
        runCycle,
        CYCLE
    ) as unknown as number;
    return { intervalTimer, hitTimers };
}

// ---- Collision effect (star scale) ----

function playCollisionEffect(setData: SetDataFn): void {
    const anim: WechatMiniprogram.Animation = wx.createAnimation({
        duration: 200,
        timingFunction: 'ease-out',
    });

    anim.scale(1.3).rotate(15).opacity(1).step();
    anim.scale(0.3).rotate(-5).opacity(0).step({ duration: 400 });
    anim.scale(0).opacity(0).step({ duration: 0 });

    setData({ collisionAnimation: anim.export() });
}

// ---- Screen shake ----

function playScreenShake(setData: SetDataFn): void {
    const anim: WechatMiniprogram.Animation = wx.createAnimation({
        duration: 50,
        timingFunction: 'linear',
    });

    anim.translateX(-3).step();
    anim.translateX(3).step();
    anim.translateX(-2).step();
    anim.translateX(2).step();
    anim.translateX(0).step();

    setData({ shakeAnimation: anim.export() });
}

// ---- Gear continuous rotation ----

function createGearRotationAnimation(setData: SetDataFn): number {
    let rotation: number = 0;
    const DURATION: number = 2000;

    const runCycle = (): void => {
        const anim: WechatMiniprogram.Animation = wx.createAnimation({
            duration: DURATION,
            timingFunction: 'linear',
        });
        rotation += 360;
        anim.rotate(rotation).step();
        setData({ gearAnimation: anim.export() });
    };

    runCycle();
    const timer: number = setInterval(runCycle, DURATION) as unknown as number;
    return timer;
}

// ---- Card entrance ----

function playCardEntrance(setData: SetDataFn): void {
    const anim: WechatMiniprogram.Animation = wx.createAnimation({
        duration: 500,
        timingFunction: 'ease-out',
    });

    anim.translateY(0).scale(1).opacity(1).step();
    setData({ cardAnimation: anim.export() });
}

// ---- Unified manager ----

export function createAnimationManager(): IAnimationManager {
    const timers: number[] = [];
    let collisionHitTimers: number[] = [];
    let stopped: boolean = false;

    return {
        startAll(setData: SetDataFn): void {
            stopped = false;

            // Title breath
            timers.push(createTitleBreathAnimation(setData));

            // Duck float
            timers.push(createDuckFloatAnimation(setData));

            // Dog collision
            const collision: IDogCollisionResult = createDogCollisionAnimation(
                setData,
                (): void => {
                    if (stopped) return;
                    playCollisionEffect(setData);
                    playScreenShake(setData);
                    void wx.vibrateShort({
                        type: 'light',
                    });
                }
            );
            timers.push(collision.intervalTimer);
            collisionHitTimers = collision.hitTimers;

            // Gear rotation
            timers.push(createGearRotationAnimation(setData));

            // Card entrance
            playCardEntrance(setData);
        },

        stopAll(): void {
            stopped = true;

            timers.forEach((t: number): void => {
                clearInterval(t);
                clearTimeout(t);
            });
            timers.length = 0;

            // Clear pending collision-hit timeouts
            collisionHitTimers.forEach((t: number): void => {
                clearTimeout(t);
            });
            collisionHitTimers = [];
        },
    };
}

export { createParticleRiseAnimation };
