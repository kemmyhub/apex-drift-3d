const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Return the fraction of lateral velocity retained over dt seconds.
 * The baseline is tuned to preserve the existing 60 FPS arcade feel while
 * producing the same decay over equal elapsed time at other frame rates.
 */
export function getLateralRetention(isDrifting, grip, dt) {
    if (!Number.isFinite(dt) || dt <= 0) return 1;
    const gripPerFrame = isDrifting
        ? 0.965
        : clamp(1 - (7.5 * Math.max(0, Number(grip) || 0)) / 60, 0.08, 0.92);
    return Math.pow(gripPerFrame, dt * 60);
}
