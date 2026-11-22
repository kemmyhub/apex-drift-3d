const THREE = window.THREE;

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.muted = false;
        this.initialized = false;
        this.engineOsc = null;
        this.engineHarmonic = null;
        this.engineFilter = null;
        this.engineGain = null;
        this.harmonicGain = null;
        this.screechGain = null;
        this.screechFilter = null;
        this.musicGain = null;
        this.musicTimer = null;
        this.musicStep = 0;
        this.lastBumpAt = 0;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            this.ctx = new AudioCtx();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.muted ? 0 : 0.82;
            this.master.connect(this.ctx.destination);

            // Layered engine note with a bright harmonic for a more convincing rev.
            this.engineOsc = this.ctx.createOscillator();
            this.engineOsc.type = "sawtooth";
            this.engineOsc.frequency.value = 48;
            this.engineHarmonic = this.ctx.createOscillator();
            this.engineHarmonic.type = "triangle";
            this.engineHarmonic.frequency.value = 96;
            this.engineFilter = this.ctx.createBiquadFilter();
            this.engineFilter.type = "lowpass";
            this.engineFilter.frequency.value = 320;
            this.engineGain = this.ctx.createGain();
            this.engineGain.gain.value = 0;
            this.harmonicGain = this.ctx.createGain();
            this.harmonicGain.gain.value = 0;
            this.engineOsc.connect(this.engineFilter);
            this.engineFilter.connect(this.engineGain);
            this.engineGain.connect(this.master);
            this.engineHarmonic.connect(this.harmonicGain);
            this.harmonicGain.connect(this.master);
            this.engineOsc.start();
            this.engineHarmonic.start();

            // Filtered tyre noise, driven by drift intensity.
            const size = this.ctx.sampleRate;
            const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            this.screechFilter = this.ctx.createBiquadFilter();
            this.screechFilter.type = "bandpass";
            this.screechFilter.frequency.value = 1250;
            this.screechFilter.Q.value = 1.1;
            this.screechGain = this.ctx.createGain();
            this.screechGain.gain.value = 0;
            noise.connect(this.screechFilter);
            this.screechFilter.connect(this.screechGain);
            this.screechGain.connect(this.master);
            noise.start();

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0;
            this.musicGain.connect(this.master);
            this.initialized = true;
        } catch (error) {
            console.warn("Web Audio unavailable:", error);
            this.ctx = null;
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    }

    setMuted(mute) {
        this.muted = !!mute;
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.82, now, 0.045);
        if (!this.muted) this.resume();
    }

    startMusic() {
        this.init();
        if (!this.ctx || this.musicTimer) return;
        this.resume();
        const melody = [0, 7, 12, 7, 3, 10, 15, 10, 0, 7, 12, 19, 15, 10, 7, 3];
        const bass = [0, 0, -5, -5, -2, -2, -7, -7];
        const scale = [55, 61.74, 65.41, 73.42, 82.41, 98, 110, 123.47, 130.81, 146.83, 164.81, 196, 220, 246.94, 261.63, 293.66, 329.63, 392, 440, 493.88];
        this.musicGain.gain.setTargetAtTime(0.48, this.ctx.currentTime, 0.4);
        this.musicTimer = window.setInterval(() => {
            if (!this.ctx || this.ctx.state !== "running") return;
            const now = this.ctx.currentTime;
            const step = this.musicStep % melody.length;
            const lead = this.ctx.createOscillator();
            const leadFilter = this.ctx.createBiquadFilter();
            const leadGain = this.ctx.createGain();
            lead.type = "triangle";
            lead.frequency.setValueAtTime(scale[melody[step]], now);
            leadFilter.type = "lowpass";
            leadFilter.frequency.value = 2100;
            leadGain.gain.setValueAtTime(0.0001, now);
            leadGain.gain.exponentialRampToValueAtTime(0.12, now + 0.025);
            leadGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.29);
            lead.connect(leadFilter);
            leadFilter.connect(leadGain);
            leadGain.connect(this.musicGain);
            lead.start(now);
            lead.stop(now + 0.31);

            if (step % 2 === 0) {
                const low = this.ctx.createOscillator();
                const lowGain = this.ctx.createGain();
                low.type = "sawtooth";
                low.frequency.setValueAtTime(55 * Math.pow(2, bass[Math.floor(step / 2) % bass.length] / 12), now);
                lowGain.gain.setValueAtTime(0.0001, now);
                lowGain.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
                lowGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
                low.connect(lowGain);
                lowGain.connect(this.musicGain);
                low.start(now);
                low.stop(now + 0.36);
            }

            // A restrained four-on-the-floor kick and alternating clap add race energy.
            if (step % 4 === 0) this.playKick(now);
            if (step % 8 === 4) this.playClap(now);
            this.musicStep++;
        }, 190);
    }

    playKick(now = this.ctx?.currentTime) {
        if (!this.ctx || !now) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(115, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.13);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 0.18);
    }

    playClap(now = this.ctx?.currentTime) {
        if (!this.ctx || !now) return;
        const length = Math.floor(this.ctx.sampleRate * 0.12);
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
        const source = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        filter.type = "highpass";
        filter.frequency.value = 1100;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.075, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        source.buffer = buffer;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        source.start(now);
    }

    updateVehicleAudio(speedRatio, isDrifting, activeRace) {
        if (!this.initialized) return;
        this.resume();
        const now = this.ctx.currentTime;
        if (!activeRace) {
            this.engineGain.gain.setTargetAtTime(0, now, 0.12);
            this.harmonicGain.gain.setTargetAtTime(0, now, 0.12);
            this.screechGain.gain.setTargetAtTime(0, now, 0.12);
            return;
        }
        const ratio = Math.min(1.25, Math.abs(speedRatio));
        const rpm = 48 + ratio * 178;
        this.engineOsc.frequency.setTargetAtTime(rpm, now, 0.055);
        this.engineHarmonic.frequency.setTargetAtTime(rpm * 2.02, now, 0.055);
        this.engineFilter.frequency.setTargetAtTime(260 + ratio * 1250, now, 0.09);
        this.engineGain.gain.setTargetAtTime(0.035 + ratio * 0.075, now, 0.08);
        this.harmonicGain.gain.setTargetAtTime(0.008 + ratio * 0.035, now, 0.08);
        this.screechFilter.frequency.setTargetAtTime(950 + ratio * 850, now, 0.08);
        this.screechGain.gain.setTargetAtTime(isDrifting && ratio > 0.2 ? 0.035 + ratio * 0.035 : 0, now, 0.07);
    }

    playTone(startHz, endHz, duration, type = "sine", volume = 0.12) {
        this.init();
        if (!this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(startHz, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), now + duration);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    playBeep(high = false) {
        this.init();
        this.startMusic();
        this.playTone(high ? 980 : 520, high ? 1480 : 390, high ? 0.28 : 0.16, "triangle", high ? 0.19 : 0.12);
    }

    playBoost() {
        this.init();
        this.playTone(180, 1050, 0.48, "sawtooth", 0.16);
        this.playTone(620, 1450, 0.3, "sine", 0.075);
    }

    playBump() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        if (now - this.lastBumpAt < 0.16) return;
        this.lastBumpAt = now;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.19);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + 0.21);
    }

    playPickup() {
        this.init();
        this.playTone(520, 1040, 0.16, "sine", 0.13);
        window.setTimeout(() => this.playTone(780, 1560, 0.2, "sine", 0.1), 85);
    }

    playWeapon(type) {
        const sounds = {
            missile: [260, 920, 0.34, "sawtooth"],
            shield: [720, 1180, 0.42, "sine"],
            shockwave: [180, 48, 0.55, "triangle"],
            nitro: [320, 1320, 0.42, "sawtooth"]
        };
        const s = sounds[type] || [440, 880, 0.25, "triangle"];
        this.init();
        this.playTone(s[0], s[1], s[2], s[3], 0.16);
    }

    playLap() {
        this.init();
        this.playTone(660, 990, 0.18, "triangle", 0.11);
    }

    playFinish() {
        this.init();
        this.playTone(520, 780, 0.28, "triangle", 0.13);
        window.setTimeout(() => this.playTone(780, 1170, 0.34, "triangle", 0.12), 170);
    }
}

export { SoundEngine };
