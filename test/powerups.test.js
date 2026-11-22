import test from "node:test";
import assert from "node:assert/strict";

class Vector3 {
    constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
    clone() { return new Vector3(this.x, this.y, this.z); }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    addScaledVector(v, scale) { this.x += v.x * scale; this.y += v.y * scale; this.z += v.z * scale; return this; }
    setY(y) { this.y = y; return this; }
    normalize() { const length = this.length() || 1; return this.multiplyScalar(1 / length); }
    multiplyScalar(scale) { this.x *= scale; this.y *= scale; this.z *= scale; return this; }
    length() { return Math.hypot(this.x, this.y, this.z); }
    distanceTo(other) { return this.clone().addScaledVector(other, -1).length(); }
    distanceToSquared(other) { const dx = this.x - other.x, dy = this.y - other.y, dz = this.z - other.z; return dx * dx + dy * dy + dz * dz; }
}

class Node {
    constructor() {
        this.position = new Vector3();
        this.rotation = { x: 0, y: 0, z: 0 };
        this.scale = { x: 1, y: 1, z: 1, setScalar(value) { this.x = this.y = this.z = value; }, multiplyScalar(value) { this.x *= value; this.y *= value; this.z *= value; } };
        this.visible = true;
        this.children = [];
    }
    add(...nodes) { this.children.push(...nodes); }
    traverse(callback) { callback(this); this.children.forEach(child => child.traverse ? child.traverse(callback) : callback(child)); }
}
class Group extends Node {}
class Geometry { dispose() { this.disposed = true; } }
class Material { constructor(options = {}) { Object.assign(this, options); } dispose() { this.disposed = true; } }
class Mesh extends Node { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; } }
class VectorGeometry extends Geometry {}
class Scene {
    constructor() { this.children = new Set(); }
    add(item) { this.children.add(item); }
    remove(item) { this.children.delete(item); }
}

const THREE = {
    Vector3, Group, Mesh, IcosahedronGeometry: VectorGeometry, TorusGeometry: VectorGeometry, SphereGeometry: VectorGeometry,
    MeshStandardMaterial: Material, MeshBasicMaterial: Material
};
globalThis.window = { THREE };
const { PowerUpManager, POWERUPS } = await import("../src/game/PowerUpManager.js");

function makeVehicle(overrides = {}) {
    return {
        position: new Vector3(), velocity: new Vector3(1, 0, 0), speed: 100, totalProgress: 0,
        finished: false, isRemote: false, isAI: false, isPlayer: false, weapon: null,
        shieldTimer: 0, stunTimer: 0, boostTimer: 0, ...overrides
    };
}
function makeManager() {
    const scene = new Scene();
    const track = { curve: {
        getPointAt(t) { return new Vector3(t * 100, 0, 0); },
        getTangentAt() { return new Vector3(0, 0, 1); }
    } };
    const messages = [];
    const manager = new PowerUpManager(scene, track, message => { if (message) messages.push(message); });
    return { manager, scene, messages };
}

test("the existing pickup catalog has four distinct original power-ups", () => {
    assert.deepEqual(POWERUPS.map(item => item.id), ["missile", "shield", "shockwave", "nitro"]);
    assert.equal(new Set(POWERUPS.map(item => item.name)).size, 4);
});

test("pickup grants a weapon only to eligible vehicles and respawns after its timer", () => {
    const { manager } = makeManager();
    const pickup = manager.pickups[0];
    const player = makeVehicle({ isPlayer: true, position: pickup.group.position.clone() });
    const remote = makeVehicle({ isRemote: true, position: pickup.group.position.clone() });
    manager.update(0, [remote], 0);
    assert.equal(pickup.active, true);
    manager.update(0, [player], 0);
    assert.equal(player.weapon, "missile");
    assert.equal(pickup.active, false);
    assert.equal(pickup.group.visible, false);
    player.finished = true;
    manager.update(8, [], 8);
    assert.equal(pickup.active, true);
    assert.equal(pickup.group.visible, true);
});

test("turbo and shield activate and set their expected timers", () => {
    const { manager } = makeManager();
    const turbo = makeVehicle({ isPlayer: true, weapon: "nitro" });
    const shield = makeVehicle({ isPlayer: true, weapon: "shield" });
    assert.equal(manager.activate(turbo, [turbo]), true);
    assert.equal(turbo.weapon, null);
    assert.equal(turbo.boostTimer, 2.15);
    assert.equal(manager.activate(shield, [shield]), true);
    assert.equal(shield.shieldTimer, 7);
});

test("homing pulse targets only a rival ahead and reports missing or out-of-range targets", () => {
    const { manager, messages } = makeManager();
    const player = makeVehicle({ isPlayer: true, weapon: "missile", totalProgress: 1 });
    const behind = makeVehicle({ totalProgress: 0.9, position: new Vector3(5, 0, 0) });
    const ahead = makeVehicle({ totalProgress: 1.2, position: new Vector3(9, 0, 0) });
    assert.equal(manager.activate(player, [player, behind, ahead]), true);
    assert.ok(ahead.stunTimer > 0);
    assert.equal(behind.stunTimer || 0, 0);

    player.weapon = "missile";
    assert.equal(manager.activate(player, [player, behind]), false);
    assert.equal(messages.at(-1), "NO TARGET IN RANGE");
    player.weapon = "missile";
    const distant = makeVehicle({ totalProgress: 2, position: new Vector3(116, 0, 0) });
    assert.equal(manager.activate(player, [player, distant]), false);
    assert.equal(player.weapon, null);
});

test("homing pulse breaks a target shield instead of stunning it", () => {
    const { manager } = makeManager();
    const player = makeVehicle({ weapon: "missile", totalProgress: 0 });
    const target = makeVehicle({ totalProgress: 1, shieldTimer: 5, position: new Vector3(8, 0, 0) });
    assert.equal(manager.activate(player, [player, target]), true);
    assert.equal(target.shieldTimer, 0);
    assert.equal(target.stunTimer || 0, 0);
});

test("shockwave hits nearby unshielded rivals, strips shields, and excludes remote/finished cars", () => {
    const { manager, messages } = makeManager();
    const player = makeVehicle({ isPlayer: true, weapon: "shockwave" });
    const near = makeVehicle({ position: new Vector3(10, 0, 0) });
    const shielded = makeVehicle({ shieldTimer: 4, position: new Vector3(14, 0, 0) });
    const remote = makeVehicle({ isRemote: true, position: new Vector3(2, 0, 0) });
    const finished = makeVehicle({ finished: true, position: new Vector3(3, 0, 0) });
    assert.equal(manager.activate(player, [player, near, shielded, remote, finished]), true);
    assert.ok(near.stunTimer > 0);
    assert.equal(near.speed, 48);
    assert.equal(shielded.shieldTimer, 0);
    assert.equal(remote.stunTimer || 0, 0);
    assert.equal(finished.stunTimer || 0, 0);
    assert.equal(messages.at(-1), "SHOCKWAVE HIT 2 RIVAL(S)");
});

test("shield and stun counters decay and short-lived visual effects dispose their resources", () => {
    const { manager, scene } = makeManager();
    const vehicle = makeVehicle({ shieldTimer: 0.25, stunTimer: 0.35 });
    manager.update(0.1, [vehicle], 0.1);
    assert.ok(Math.abs(vehicle.shieldTimer - 0.15) < 1e-9);
    assert.ok(Math.abs(vehicle.stunTimer - 0.25) < 1e-9);

    manager.burst(vehicle.position, 0x42e8ff, 4);
    const effect = manager.effects[0];
    manager.update(0.56, [], 0.66);
    assert.equal(manager.effects.length, 0);
    assert.equal(scene.children.has(effect.mesh), false);
    assert.equal(effect.mesh.geometry.disposed, true);
    assert.equal(effect.mesh.material.disposed, true);
});

test("AI can activate a power-up with deterministic randomness and manager cleanup disposes resources", () => {
    const { manager, scene } = makeManager();
    const ai = makeVehicle({ isAI: true, weapon: "shield", aiWeaponTimer: 0 });
    const originalRandom = Math.random;
    Math.random = () => 0;
    try { manager.update(1.2, [ai], 1.2); }
    finally { Math.random = originalRandom; }
    assert.equal(ai.shieldTimer, 7);
    assert.equal(ai.weapon, null);

    const pickups = [...manager.pickups];
    const effects = [...manager.effects];
    manager.dispose();
    assert.equal(manager.pickups.length, 0);
    assert.equal(manager.effects.length, 0);
    assert.equal(scene.children.size, 0);
    assert.ok(pickups.every(pickup => pickup.group.children.every(node => node.geometry.disposed && node.material.disposed)));
    assert.ok(effects.every(effect => effect.mesh.geometry.disposed && effect.mesh.material.disposed));
});
