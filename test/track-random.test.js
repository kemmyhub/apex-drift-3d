import test from "node:test";
import assert from "node:assert/strict";
import { createSeededRandom } from "../src/game/TrackRandom.js";

function sample(seed) {
    const random = createSeededRandom(seed);
    return Array.from({ length: 12 }, () => random());
}

test("track-specific seeded randomness is repeatable and separates environments", () => {
    assert.deepEqual(sample("alpine-pass"), sample("alpine-pass"));
    assert.notDeepEqual(sample("alpine-pass"), sample("desert-run"));
});

test("seeded random values stay in the expected interval", () => {
    for (const value of sample("neon-coast")) assert.ok(value >= 0 && value < 1);
});
