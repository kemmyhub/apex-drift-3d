import test from "node:test";
import assert from "node:assert/strict";

class Vector3 {}
globalThis.window = { THREE: { Vector3 } };
const { ApexDriftApp } = await import("../src/game/ApexDriftApp.js");

function makeElement() {
    const events = {};
    const classes = new Set(["hidden"]);
    return {
        events,
        classList: {
            add(name) { classes.add(name); },
            remove(name) { classes.delete(name); },
            contains(name) { return classes.has(name); }
        },
        addEventListener(name, callback) { (events[name] ||= []).push(callback); },
        setPointerCapture() {},
        fire(name, event = {}) { (events[name] || []).forEach(callback => callback({ preventDefault() {}, ...event })); }
    };
}

function withGlobals(win, doc, run) {
    const oldWindow = globalThis.window;
    const oldDocument = globalThis.document;
    globalThis.window = win;
    globalThis.document = doc;
    try { return run(); }
    finally {
        globalThis.window = oldWindow;
        if (oldDocument === undefined) delete globalThis.document;
        else globalThis.document = oldDocument;
    }
}

test("pause clears held actions and resume restores race/countdown state", () => {
    const elements = { "ui-pause": makeElement(), "btn-pause-race": makeElement() };
    const oldDocument = globalThis.document;
    globalThis.document = { getElementById(id) { return elements[id] || null; } };
    try {
        const app = Object.create(ApexDriftApp.prototype);
        app.dialogFocus = { open() {}, closeIfOpen() {} };
        app.mode = "COUNTDOWN";
        app.input = { up: true, down: false, left: true, right: false, drift: true, boost: true };
        app.sound = { updateVehicleAudio() {} };
        app.countdownTimer = 123;
        app.runCountdown = resume => { assert.equal(resume, true); app.mode = "COUNTDOWN"; };
        app.togglePause();
        assert.equal(app.mode, "PAUSED");
        assert.deepEqual(app.input, { up: false, down: false, left: false, right: false, drift: false, boost: false });
        assert.equal(elements["ui-pause"].classList.contains("hidden"), false);
        app.resumeRace();
        assert.equal(app.mode, "COUNTDOWN");
        assert.equal(elements["ui-pause"].classList.contains("hidden"), true);
    } finally {
        if (oldDocument === undefined) delete globalThis.document;
        else globalThis.document = oldDocument;
    }
});

test("restart retains race type and multiplayer roster while returning through menu cleanup", () => {
    const app = Object.create(ApexDriftApp.prototype);
    app.raceType = "MP";
    app.mp = { players: { a: { id: "a" }, b: { id: "b" } } };
    const calls = [];
    app.returnToMenu = () => calls.push(["menu"]);
    app.startRace = (type, roster) => calls.push(["start", type, roster]);
    app.restartRace();
    assert.equal(calls[0][0], "menu");
    assert.equal(calls[1][1], "MP");
    assert.deepEqual(calls[1][2].map(player => player.id), ["a", "b"]);
});

test("countdown pause cancels its pending tick and resumes at the next visible step", () => {
    const oldSetTimeout = globalThis.setTimeout;
    const oldClearTimeout = globalThis.clearTimeout;
    const timers = [];
    const cleared = [];
    let nextId = 1;
    globalThis.setTimeout = (callback, delay) => { timers.push({ id: nextId, callback, delay }); return nextId++; };
    globalThis.clearTimeout = id => cleared.push(id);
    const elements = { "hud-countdown": makeElement(), "ui-pause": makeElement(), "btn-pause-race": makeElement() };
    const oldDocument = globalThis.document;
    globalThis.document = { getElementById(id) { return elements[id] || null; } };
    try {
        const app = Object.create(ApexDriftApp.prototype);
        app.dialogFocus = { open() {}, closeIfOpen() {} };
        app.vehicles = [];
        app.sound = { playBeep() {}, updateVehicleAudio() {} };
        app.runCountdown();
        assert.equal(elements["hud-countdown"].textContent, "3");
        const pendingId = app.countdownTimer;
        app.togglePause();
        assert.deepEqual(cleared, [pendingId]);
        app.resumeRace();
        assert.equal(app.mode, "COUNTDOWN");
        assert.equal(elements["hud-countdown"].textContent, "2");
        assert.notEqual(app.countdownTimer, pendingId);
    } finally {
        globalThis.setTimeout = oldSetTimeout;
        globalThis.clearTimeout = oldClearTimeout;
        if (oldDocument === undefined) delete globalThis.document;
        else globalThis.document = oldDocument;
    }
});

test("touch/pointer controls release on cancellation, lost capture, and window blur", () => {
    const listeners = {};
    const win = { PointerEvent: function PointerEvent() {}, addEventListener(type, callback) { (listeners[type] ||= []).push(callback); } };
    const elements = Object.fromEntries(["touch-left", "touch-right", "touch-drift", "touch-gas", "touch-brake", "touch-boost"].map(id => [id, makeElement()]));
    const doc = { activeElement: null, visibilityState: "visible", addEventListener(type, callback) { (listeners[`document:${type}`] ||= []).push(callback); }, getElementById(id) { return elements[id] || null; } };
    const app = Object.create(ApexDriftApp.prototype);
    app.input = { up: false, down: false, left: false, right: false, drift: false, boost: false };
    withGlobals(win, doc, () => {
        app.bindInputs();
        elements["touch-gas"].fire("pointerdown", { pointerId: 4, button: 0 });
        assert.equal(app.input.up, true);
        elements["touch-gas"].fire("pointerup", { pointerId: 4 });
        assert.equal(app.input.up, false);

        elements["touch-left"].fire("pointerdown", { pointerId: 5, button: 0 });
        assert.equal(app.input.left, true);
        listeners.keydown[0]({ code: "ArrowLeft", preventDefault() {} });
        elements["touch-left"].fire("pointerup", { pointerId: 5 });
        assert.equal(app.input.left, true);
        listeners.keyup[0]({ code: "ArrowLeft" });
        assert.equal(app.input.left, false);
        elements["touch-left"].fire("pointerdown", { pointerId: 7, button: 0 });
        elements["touch-left"].fire("lostpointercapture", { pointerId: 5 });
        elements["touch-left"].fire("lostpointercapture", { pointerId: 7 });
        assert.equal(app.input.left, false);

        elements["touch-brake"].fire("pointerdown", { pointerId: 8, button: 0 });
        assert.equal(app.input.down, true);
        elements["touch-brake"].fire("pointercancel", { pointerId: 8 });
        assert.equal(app.input.down, false);

        elements["touch-boost"].fire("pointerdown", { pointerId: 6, button: 0 });
        assert.equal(app.input.boost, true);
        listeners.blur.forEach(callback => callback());
        assert.equal(app.input.boost, false);
    });
});
