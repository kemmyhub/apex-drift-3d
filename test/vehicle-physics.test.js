import test from "node:test";
import assert from "node:assert/strict";
import { getLateralRetention } from "../src/game/VehiclePhysics.js";

function retentionOverOneSecond(isDrifting, grip, framesPerSecond) {
    const dt = 1 / framesPerSecond;
    let retained = 1;
    for (let frame = 0; frame < framesPerSecond; frame += 1) {
        retained *= getLateralRetention(isDrifting, grip, dt);
    }
    return retained;
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
