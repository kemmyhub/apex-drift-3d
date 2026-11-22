import { getLocalStorageItem, setLocalStorageItem } from "../utils/storage.js";

const STORAGE_KEY = "apex_upgrades_v1";
const TYPES = {
    engine: { label: "Engine", costs: [350, 600, 900, 1300, 1800] },
    handling: { label: "Handling", costs: [350, 600, 900, 1300, 1800] },
    nitro: { label: "Nitro", costs: [300, 550, 850, 1200, 1650] }
};
const emptyCarUpgrades = () => ({ engine: 0, handling: 0, nitro: 0 });

class UpgradeManager {
    constructor(profile) {
        this.profile = profile;
        this.data = this.load();
    }

    load() {
        try {
            const stored = JSON.parse(getLocalStorageItem(STORAGE_KEY) || "{}");
            if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
            const clean = {};
            Object.keys(stored || {}).forEach(carId => {
                clean[carId] = {};
                Object.keys(TYPES).forEach(type => {
                    const value = Number(stored[carId]?.[type]);
                    clean[carId][type] = Number.isFinite(value) ? Math.max(0, Math.min(5, Math.floor(value))) : 0;
                });
            });
            return clean;
        } catch {
            return {};
        }
    }

    save() {
        setLocalStorageItem(STORAGE_KEY, JSON.stringify(this.data));
    }

    levels(carId) {
        return { ...emptyCarUpgrades(), ...(this.data[carId] || {}) };
    }

    nextCost(carId, type) {
        const level = this.levels(carId)[type];
        return level >= 5 ? null : TYPES[type].costs[level];
    }

    purchase(carId, type) {
        if (!TYPES[type]) return { ok: false, reason: "Unknown upgrade." };
        const level = this.levels(carId)[type];
        if (level >= 5) return { ok: false, reason: "This upgrade is already maxed." };
        const cost = TYPES[type].costs[level];
        if (this.profile.data.credits < cost) return { ok: false, reason: "Not enough credits." };
        this.profile.data.credits -= cost;
        this.profile.save();
        if (!this.data[carId]) this.data[carId] = emptyCarUpgrades();
        this.data[carId][type] = level + 1;
        this.save();
        return { ok: true, cost, level: level + 1 };
    }

    applyToSpec(baseSpec, carId) {
        const levels = this.levels(carId);
        const engine = levels.engine;
        const handling = levels.handling;
        const nitro = levels.nitro;
        return {
            ...baseSpec,
            stats: {
                ...baseSpec.stats,
                speed: Math.min(100, Math.round(baseSpec.stats.speed + engine * 2)),
                accel: Math.min(100, Math.round(baseSpec.stats.accel + engine * 1.5)),
                handling: Math.min(100, Math.round(baseSpec.stats.handling + handling * 3))
            },
            maxSpeed: baseSpec.maxSpeed * (1 + engine * 0.04),
            accelForce: baseSpec.accelForce * (1 + engine * 0.04),
            turnRate: baseSpec.turnRate * (1 + handling * 0.05),
            grip: baseSpec.grip * (1 + handling * 0.03),
            nitroDuration: 1.45 + nitro * 0.12
        };
    }
}

export { UpgradeManager, TYPES as UPGRADE_TYPES };
