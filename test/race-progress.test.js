import test from "node:test";
import assert from "node:assert/strict";

class Vector3 {
    constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
    distanceTo(other) { return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z); }
}

// Vehicle reads the browser's Three.js global at module evaluation; progress tests need only vectors.
globalThis.window = { THREE: { Vector3 } };
const { Vehicle } = await import("../src/game/Vehicle.js");

function makeVehicle() {
    const vehicle = Object.create(Vehicle.prototype);
    Object.assign(vehicle, {
        track: {
            checkpoints: [
                { position: new Vector3(0, 0, 0), radius: 2 },
                { position: new Vector3(10, 0, 0), radius: 2 },
                { position: new Vector3(20, 0, 0), radius: 2 }
            ],
            getClosestTrackInfo: () => ({ t: 0.5 })
        },
        position: new Vector3(),
        nextCheckpoint: 1,
        lap: 1,
        trackT: 0,
        totalProgress: 0,
        finished: false,
        finishTime: 0,
        currentLapStart: 0,
        bestLapTime: Infinity
    });
    return vehicle;
}

test("checkpoint sequence wraps at the start gate, times completed laps, and finishes after three laps", () => {
    const vehicle = makeVehicle();
    vehicle.position = new Vector3(10, 0, 0);
    vehicle.updateLapProgress(2);
    assert.equal(vehicle.nextCheckpoint, 2);
    assert.equal(vehicle.lap, 1);

    vehicle.position = new Vector3(20, 0, 0);
    vehicle.updateLapProgress(4);
    assert.equal(vehicle.nextCheckpoint, 0);
    assert.equal(vehicle.lap, 1);

    vehicle.position = new Vector3(0, 0, 0);
    vehicle.updateLapProgress(10);
    assert.equal(vehicle.nextCheckpoint, 1);
    assert.equal(vehicle.lap, 2);
    assert.equal(vehicle.bestLapTime, 10);
    assert.equal(vehicle.currentLapStart, 10);

    for (const raceClock of [20, 30]) {
        for (const checkpoint of [10, 20, 0]) {
            vehicle.position = new Vector3(checkpoint, 0, 0);
            vehicle.updateLapProgress(raceClock);
        }
    }
    assert.equal(vehicle.finished, true);
    assert.equal(vehicle.finishTime, 30);
    assert.equal(vehicle.lap, 3);
});
