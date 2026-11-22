const STORAGE_KEY = "apex_profile_v1";

function emptyProfile() {
    return {
        xp: 0,
        credits: 0,
        races: 0,
        wins: 0,
        podiums: 0,
        totalDriftPoints: 0,
        bestLap: null
    };
}

class ProfileManager {
    constructor() {
        this.data = this.load();
    }

    load() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (!stored || typeof stored !== "object") return emptyProfile();
            const defaults = emptyProfile();
            return Object.fromEntries(Object.keys(defaults).map(key => {
                const value = stored[key];
                return [key, typeof defaults[key] === "number" && Number.isFinite(value) ? value : defaults[key]];
            }));
        } catch {
            return emptyProfile();
        }
    }

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (error) {
            console.warn("APEX profile could not be saved in this browser.", error);
        }
    }

    get level() {
        return Math.floor(Math.sqrt(Math.max(0, this.data.xp) / 250)) + 1;
    }

    get levelFloorXP() {
        return (this.level - 1) ** 2 * 250;
    }

    get nextLevelXP() {
        return this.level ** 2 * 250;
    }

    get levelProgress() {
        const span = this.nextLevelXP - this.levelFloorXP;
        return span > 0 ? Math.min(100, ((this.data.xp - this.levelFloorXP) / span) * 100) : 0;
    }

    recordRace({ position, driftPoints = 0, bestLap = null, mode = "SP" }) {
        const place = Math.max(1, Number(position) || 4);
        const drift = Math.max(0, Math.floor(Number(driftPoints) || 0));
        const placementXP = [180, 130, 95, 70][Math.min(place - 1, 3)];
        const placementCredits = [300, 220, 160, 110][Math.min(place - 1, 3)];
        const driftXP = Math.floor(drift / 80);
        const driftCredits = Math.floor(drift / 160);
        const modeBonus = mode === "TT" ? 1.15 : 1;
        const xpEarned = Math.round((100 + placementXP + driftXP) * modeBonus);
        const creditsEarned = Math.round((placementCredits + driftCredits) * modeBonus);

        this.data.xp += xpEarned;
        this.data.credits += creditsEarned;
        this.data.races += 1;
        this.data.wins += place === 1 ? 1 : 0;
        this.data.podiums += place <= 3 ? 1 : 0;
        this.data.totalDriftPoints += drift;
        if (Number.isFinite(bestLap) && bestLap > 0 && (!this.data.bestLap || bestLap < this.data.bestLap)) {
            this.data.bestLap = bestLap;
        }
        this.save();

        return {
            position: place,
            xpEarned,
            creditsEarned,
            driftPoints: drift,
            level: this.level,
            levelProgress: this.levelProgress,
            leveledUp: this.level > Math.floor(Math.sqrt(Math.max(0, this.data.xp - xpEarned) / 250)) + 1
        };
    }

    reset() {
        this.data = emptyProfile();
        this.save();
    }
}

export { ProfileManager };
