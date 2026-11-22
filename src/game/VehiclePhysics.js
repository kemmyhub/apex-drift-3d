const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Frame-rate-independent lateral grip retention, preserving the prior 60 FPS baseline. */
export function getLateralRetention(isDrifting, grip, dt) {
    if (!Number.isFinite(dt) || dt <= 0) return 1;
    const gripPerFrame = isDrifting
        ? 0.965
        : clamp(1 - (7.5 * Math.max(0, Number(grip) || 0)) / 60, 0.08, 0.92);
    return Math.pow(gripPerFrame, dt * 60);
}

/**
 * Advance signed longitudinal speed. Opposite-direction input brakes to zero
 * before accelerating in reverse; fractional AI throttle remains meaningful.
 */
export function stepLongitudinalSpeed({
    speed,
    throttle,
    dt,
    accelForce,
    maxSpeed,
    maxReverseSpeed = 18,
    boostMultiplier = 1,
    brakeForce = accelForce * 1.45
}) {
    if (!Number.isFinite(dt) || dt <= 0) return clamp(speed, -maxReverseSpeed, maxSpeed);
    let nextSpeed = Number.isFinite(speed) ? speed : 0;
    const input = clamp(Number(throttle) || 0, -1, 1);

    if (input > 0) {
        if (nextSpeed < 0) nextSpeed = Math.min(0, nextSpeed + brakeForce * input * dt);
        else nextSpeed += accelForce * boostMultiplier * input * dt;
    } else if (input < 0) {
        if (nextSpeed > 0) nextSpeed = Math.max(0, nextSpeed - brakeForce * -input * dt);
        else nextSpeed -= accelForce * 0.6 * -input * dt;
    } else {
        const dragRate = 0.08 + Math.abs(nextSpeed) * 0.0018;
        nextSpeed *= Math.exp(-dragRate * dt);
        if (Math.abs(nextSpeed) < 0.025) nextSpeed = 0;
    }

    return clamp(nextSpeed, -maxReverseSpeed, maxSpeed * boostMultiplier);
}

/** Lower steering response as speed rises, while retaining responsive low-speed steering. */
export function getSteeringRate(speed, baseTurnRate, isDrifting = false) {
    const absoluteSpeed = Math.abs(Number(speed) || 0);
    const lowSpeedResponse = clamp(absoluteSpeed / 22, 0, 1);
    const highSpeedStability = 1 / (1 + (absoluteSpeed / 80) ** 2 * 0.85);
    const driftResponse = isDrifting ? 1.14 : 1;
    return baseTurnRate * lowSpeedResponse * highSpeedStability * driftResponse;
}

/** Clamp a car to the usable track edge and remove outward wall-normal velocity. */
export function applyTrackBoundaryResponse(position, velocity, center, maxDistance, restitution = 0.06) {
    const dx = position.x - center.x;
    const dz = position.z - center.z;
    const distance = Math.hypot(dx, dz);
    if (!Number.isFinite(distance) || distance <= maxDistance || distance < 1e-8) return null;

    const nx = dx / distance;
    const nz = dz / distance;
    const outwardSpeed = velocity.x * nx + velocity.z * nz;
    return {
        position: { x: center.x + nx * maxDistance, z: center.z + nz * maxDistance },
        velocity: outwardSpeed > 0
            ? { x: velocity.x - (1 + restitution) * outwardSpeed * nx, z: velocity.z - (1 + restitution) * outwardSpeed * nz }
            : { x: velocity.x, z: velocity.z },
        normal: { x: nx, z: nz },
        penetration: distance - maxDistance
    };
}
