import test from "node:test";
import assert from "node:assert/strict";
import {
    applyTrackBoundaryResponse,
    getLateralRetention,
    getSteeringRate,
    stepLongitudinalSpeed
} from "../src/game/VehiclePhysics.js";

function retentionOverOneSecond(isDrifting, grip, framesPerSecond) {
    const dt = 1 / framesPerSecond;
    let retained = 1;
    for (let frame = 0; frame < framesPerSecond; frame += 1) {
        retained *= getLateralRetention(isDrifting, grip, dt);
    }
    return retained;
}

function advanceSpeed(initialSpeed, throttle, fps, seconds = 1, multiplier = 1) {
    let speed = initialSpeed;
    const dt = 1 / fps;
    for (let frame = 0; frame < fps * seconds; frame += 1) {
        speed = stepLongitudinalSpeed({
            speed, throttle, dt, accelForce: 50, maxSpeed: 100,
            boostMultiplier: multiplier
        });
    }
    return speed;
}

test("normal tire grip has consistent lateral decay at 30, 60, and 120 FPS", () => {
    const results = [30, 60, 120].map(fps => retentionOverOneSecond(false, 0.92, fps));
    assert.ok(results.every(value => Math.abs(value - results[1]) < 1e-12));
});

test("drifting has consistent lateral decay at 30, 60, and 120 FPS", () => {
    const results = [30, 60, 120].map(fps => retentionOverOneSecond(true, 0.92, fps));
    assert.ok(results.every(value => Math.abs(value - results[1]) < 1e-12));
});

test("non-positive or invalid frame times do not erase lateral velocity", () => {
    assert.equal(getLateralRetention(true, 0.92, 0), 1);
    assert.equal(getLateralRetention(false, 0.92, -0.01), 1);
    assert.equal(getLateralRetention(true, 0.92, Number.NaN), 1);
});

test("opposite input brakes forward motion to zero instead of crossing into reverse", () => {
    assert.equal(stepLongitudinalSpeed({ speed: 2, throttle: -1, dt: 0.1, accelForce: 50, maxSpeed: 100 }), 0);
    assert.equal(stepLongitudinalSpeed({ speed: -2, throttle: 1, dt: 0.1, accelForce: 50, maxSpeed: 100 }), 0);
});

test("continued reverse input engages reverse only after reaching zero", () => {
    const stopped = stepLongitudinalSpeed({ speed: 1, throttle: -1, dt: 0.1, accelForce: 50, maxSpeed: 100 });
    assert.equal(stopped, 0);
    const reversing = stepLongitudinalSpeed({ speed: stopped, throttle: -1, dt: 0.1, accelForce: 50, maxSpeed: 100 });
    assert.ok(reversing < 0);
});

test("fractional AI throttle produces a slower acceleration response", () => {
    assert.ok(advanceSpeed(0, 0.5, 60) < advanceSpeed(0, 1, 60));
});

test("coasting and acceleration remain stable across common frame rates", () => {
    for (const throttle of [0, 1]) {
        const results = [30, 60, 120].map(fps => advanceSpeed(70, throttle, fps));
        assert.ok(Math.max(...results) - Math.min(...results) < 0.02);
    }
});

test("boost scales powered acceleration without creating a speed floor while coasting", () => {
    assert.ok(advanceSpeed(20, 1, 60, 0.5, 1.3) > advanceSpeed(20, 1, 60, 0.5));
    assert.ok(advanceSpeed(20, 0, 60, 0.5, 1.3) < 20);
});

test("steering response is stable at low speed and reduced at high speed", () => {
    assert.ok(getSteeringRate(15, 2.4) > 0);
    assert.ok(getSteeringRate(90, 2.4) < getSteeringRate(35, 2.4));
    assert.ok(getSteeringRate(90, 2.4, true) > getSteeringRate(90, 2.4));
});

test("track boundary response clamps position and removes outward velocity", () => {
    const result = applyTrackBoundaryResponse(
        { x: 12, z: 0 }, { x: 8, z: 3 }, { x: 0, z: 0 }, 10, 0
    );
    assert.deepEqual(result.position, { x: 10, z: 0 });
    assert.deepEqual(result.velocity, { x: 0, z: 3 });
    assert.equal(applyTrackBoundaryResponse({ x: 5, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 0 }, 10), null);
});
