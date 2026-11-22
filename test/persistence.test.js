import test from "node:test";
import assert from "node:assert/strict";
import { ProfileManager } from "../src/game/ProfileManager.js";
import { UpgradeManager } from "../src/game/UpgradeManager.js";
import { AchievementManager } from "../src/game/AchievementManager.js";

function withStorage(initial, run) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const values = new Map(Object.entries(initial));
    Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); }
    } });
    try {
        return run(values);
    } finally {
        if (previous) Object.defineProperty(globalThis, "localStorage", previous);
        else delete globalThis.localStorage;
    }
}

test("missing and malformed profile data safely falls back to a playable empty profile", () => {
    withStorage({ apex_profile_v1: "{" }, () => {
        const profile = new ProfileManager();
        assert.deepEqual(profile.data, {
            xp: 0, credits: 0, races: 0, wins: 0, podiums: 0, totalDriftPoints: 0, bestLap: null
        });
        profile.recordRace({ position: 1, driftPoints: 160, bestLap: 88.5 });
        assert.equal(profile.data.races, 1);
        assert.equal(profile.data.wins, 1);
        assert.equal(profile.data.bestLap, 88.5);
    });
    withStorage({}, () => assert.equal(new ProfileManager().data.credits, 0));
});

test("upgrade levels are bounded, purchases validate funds, and car stats apply", () => {
    withStorage({
        apex_profile_v1: JSON.stringify({ xp: 0, credits: 1000, races: 0, wins: 0, podiums: 0, totalDriftPoints: 0, bestLap: null }),
        apex_upgrades_v1: JSON.stringify({ carA: { engine: 99, handling: -3, nitro: "bad" } })
    }, (values) => {
        const profile = new ProfileManager();
        const upgrades = new UpgradeManager(profile);
        assert.deepEqual(upgrades.levels("carA"), { engine: 5, handling: 0, nitro: 0 });
        assert.equal(upgrades.purchase("carA", "unknown").ok, false);
        profile.data.credits = 349;
        assert.equal(upgrades.purchase("carB", "handling").ok, false);
        profile.data.credits = 1000;
        const result = upgrades.purchase("carB", "handling");
        assert.deepEqual(result, { ok: true, cost: 350, level: 1 });
        assert.equal(profile.data.credits, 650);
        assert.equal(JSON.parse(values.get("apex_upgrades_v1")).carB.handling, 1);
        const base = { stats: { speed: 90, accel: 85, handling: 80 }, maxSpeed: 100, accelForce: 20, turnRate: 1, grip: 1 };
        assert.equal(upgrades.applyToSpec(base, "carB").stats.handling, 83);
    });
});

test("corrupt achievements are ignored and completed achievements award once", () => {
    withStorage({
        apex_achievements_v1: JSON.stringify(["unknown", "first-race", "first-race"]),
        apex_profile_v1: JSON.stringify({ xp: 0, credits: 0, races: 1, wins: 0, podiums: 0, totalDriftPoints: 0, bestLap: null })
    }, (values) => {
        const profile = new ProfileManager();
        const achievements = new AchievementManager(profile);
        assert.deepEqual(achievements.unlocked, ["first-race"]);
        assert.deepEqual(achievements.evaluate(), []);
        profile.data.races = 10;
        const newlyUnlocked = achievements.evaluate();
        assert.equal(newlyUnlocked.some(item => item.id === "ten-races"), true);
        const awardedCredits = profile.data.credits;
        assert.deepEqual(achievements.evaluate(), []);
        assert.equal(profile.data.credits, awardedCredits);
        assert.equal(JSON.parse(values.get("apex_achievements_v1")).includes("ten-races"), true);
    });
});

test("denied and quota-exceeded storage never throws from profile saves", () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("denied"); } });
        const denied = new ProfileManager();
        assert.doesNotThrow(() => denied.recordRace({ position: 2 }));

        Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: {
            getItem() { return null; },
            setItem() { throw new Error("quota exceeded"); }
        } });
        const quota = new ProfileManager();
        assert.doesNotThrow(() => quota.recordRace({ position: 1 }));
    } finally {
        console.warn = originalWarn;
        if (previous) Object.defineProperty(globalThis, "localStorage", previous);
        else delete globalThis.localStorage;
    }
});
