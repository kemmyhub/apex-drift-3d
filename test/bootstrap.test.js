import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapGame } from "../src/game/bootstrap.js";

function makeDocument() {
    const actions = [];
    const reload = {
        dataset: {},
        addEventListener(type, callback) { actions.push({ type, callback }); }
    };
    const panel = {
        hidden: true,
        focused: false,
        focus() { this.focused = true; },
        querySelector() { return reload; }
    };
    const canvas = { style: {} };
    const menu = { setAttribute(name, value) { this[name] = value; } };
    const controls = { setAttribute(name, value) { this[name] = value; } };
    return {
        actions,
        reload,
        panel,
        canvas,
        menu,
        controls,
        getElementById(id) {
            return {
                "game-startup-error": panel,
                "game-canvas": canvas,
                "ui-main-menu": menu,
                "global-controls": controls
            }[id] || null;
        }
    };
}

test("missing Three.js displays a focused accessible fallback and does not create the game", () => {
    const doc = makeDocument();
    const win = { location: { reload() {} } };
    let created = false;
    const originalError = console.error;
    console.error = () => {};
    try {
        assert.equal(bootstrapGame({ documentRef: doc, windowRef: win, createApp: () => { created = true; } }), false);
    } finally {
        console.error = originalError;
    }
    assert.equal(created, false);
    assert.equal(doc.panel.hidden, false);
    assert.equal(doc.panel.focused, true);
    assert.equal(doc.canvas.style.display, "none");
    assert.equal(doc.menu["aria-hidden"], "true");
    assert.equal(doc.menu.inert, true);
    assert.equal(doc.controls["aria-hidden"], "true");
    assert.equal(doc.controls.inert, true);
    assert.equal(doc.actions.length, 1);
});

test("renderer construction errors are contained and still expose reload recovery", () => {
    const doc = makeDocument();
    let reloads = 0;
    const win = { THREE: { WebGLRenderer() {} }, location: { reload() { reloads += 1; } } };
    const originalError = console.error;
    console.error = () => {};
    try {
        assert.equal(bootstrapGame({ documentRef: doc, windowRef: win, createApp: () => { throw new Error("WebGL unavailable"); } }), false);
    } finally {
        console.error = originalError;
    }
    assert.equal(doc.panel.hidden, false);
    doc.actions[0].callback();
    assert.equal(reloads, 1);
});

test("successful initialization stores the app and leaves the fallback hidden", () => {
    const doc = makeDocument();
    const app = { mode: "MENU" };
    const win = { THREE: { WebGLRenderer() {} } };
    assert.equal(bootstrapGame({ documentRef: doc, windowRef: win, createApp: () => app }), true);
    assert.equal(win.apexGame, app);
    assert.equal(doc.panel.hidden, true);
});
