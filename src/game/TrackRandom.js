export function createSeededRandom(seedText) {
    let state = 2166136261;
    for (const char of String(seedText)) {
        state ^= char.charCodeAt(0);
        state = Math.imul(state, 16777619) >>> 0;
    }
    if (state === 0) state = 1;

    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}
