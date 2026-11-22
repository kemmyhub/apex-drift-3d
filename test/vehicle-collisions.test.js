import test from "node:test";
import assert from "node:assert/strict";
import { resolveVehicleCollisions } from "../src/game/VehicleCollisions.js";

function car(id, x, velocityX, options = {}) {
    return {
        id,
        position: { x, z: 0 },
        velocity: { x: velocityX, z: 0 },
        speed: velocityX,
        heading: Math.PI / 2,
        isRemote: Boolean(options.isRemote),
        isPlayer: Boolean(options.isPlayer)
    };
}

function resolveById(order) {
    const cars = [car("a", -1, 5), car("b", 1, -5)];
    const ordered = order.map(id => cars.find(item => item.id === id));
    resolveVehicleCollisions(ordered);
    return Object.fromEntries(cars.map(item => [item.id, { x: item.position.x, vx: item.velocity.x, speed: item.speed }]));
}

function resolveCluster(order) {
    const cars = [car("a", -1, 3), car("b", 0, 0), car("c", 1, -3)];
    const ordered = order.map(id => cars.find(item => item.id === id));
    resolveVehicleCollisions(ordered);
    return Object.fromEntries(cars.map(item => [item.id, [item.position.x, item.position.z, item.velocity.x, item.velocity.z, item.speed]]));
}

test("a colliding pair is separated once with order-independent velocity response", () => {
    assert.deepEqual(resolveById(["a", "b"]), resolveById(["b", "a"]));
    const state = resolveById(["a", "b"]);
    assert.ok(Math.abs(state.a.x - state.b.x) >= 2.8 - 1e-9);
    assert.ok(state.a.vx < 0 && state.b.vx > 0);
});

test("coincident cars separate deterministically and never remain overlapped", () => {
    const first = car("player", 0, 0, { isPlayer: true });
    const second = car("ai", 0, 0);
    const impacts = resolveVehicleCollisions([first, second]);
    assert.ok(Math.hypot(first.position.x - second.position.x, first.position.z - second.position.z) >= 2.8 - 1e-9);
    assert.equal(impacts.length, 0, "stationary overlap correction is not an impact impulse");
});

test("three-car clustered resolution is independent of input permutation", () => {
    const expected = resolveCluster(["a", "b", "c"]);
    for (const order of [["c", "b", "a"], ["b", "a", "c"], ["b", "c", "a"], ["a", "c", "b"]]) {
        assert.deepEqual(resolveCluster(order), expected);
    }
});

test("player impact callback fires only for a meaningful impulse, not persistent contact", () => {
    const player = car("player", 0, 3, { isPlayer: true });
    const rival = car("rival", 2, -3);
    let callbacks = 0;
    resolveVehicleCollisions([player, rival], () => { callbacks += 1; });
    assert.equal(callbacks, 1);
    assert.equal(resolveVehicleCollisions([player, rival], () => { callbacks += 1; }).length, 0);
    assert.equal(callbacks, 1);
});

test("remote cars are treated as immovable while local cars resolve the collision", () => {
    const local = car("local", 0, 5, { isPlayer: true });
    const remote = car("remote", 2, 0, { isRemote: true });
    const remoteX = remote.position.x;
    resolveVehicleCollisions([local, remote]);
    assert.equal(remote.position.x, remoteX);
    assert.ok(local.position.x < 0);
    assert.equal(local.speed, local.velocity.x);
});
