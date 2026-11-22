import test from "node:test";
import assert from "node:assert/strict";
import { setLocalStorageItem, STORAGE_WARNING_EVENT } from "../src/utils/storage.js";

test("a rejected browser save returns false and dispatches the user-facing warning asynchronously", async () => {
    const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const oldWindow = globalThis.window;
    const oldCustomEvent = globalThis.CustomEvent;
    const events = [];
    globalThis.CustomEvent = class {
        constructor(type, options) { this.type = type; this.detail = options.detail; }
    };
    globalThis.window = { dispatchEvent(event) { events.push(event); } };
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("storage denied"); } });
    try {
        assert.equal(setLocalStorageItem("apex_profile_v1", "{}"), false);
        assert.equal(events.length, 0);
        await new Promise(resolve => queueMicrotask(resolve));
        assert.equal(events.length, 1);
        assert.equal(events[0].type, STORAGE_WARNING_EVENT);
        assert.match(events[0].detail.message, /could not be saved/i);
    } finally {
        if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage);
        else delete globalThis.localStorage;
        if (oldWindow === undefined) delete globalThis.window;
        else globalThis.window = oldWindow;
        if (oldCustomEvent === undefined) delete globalThis.CustomEvent;
        else globalThis.CustomEvent = oldCustomEvent;
    }
});
