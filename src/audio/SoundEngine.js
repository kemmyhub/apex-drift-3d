const THREE = window.THREE;

class SoundEngine {
        constructor() {
            this.ctx = null;
            this.muted = false;
            this.engineOsc = null;
            this.engineGain = null;
            this.screechGain = null;
            this.musicGain = null;
            this.musicTimer = null;
            this.musicStep = 0;
            this.initialized = false;
        }

        init() {
            if (this.initialized) return;
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioCtx();

                // Engine continuous sawtooth + lowpass filter
                this.engineOsc = this.ctx.createOscillator();
                this.engineOsc.type = 'sawtooth';
                this.engineOsc.frequency.value = 55;

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 240;

                this.engineGain = this.ctx.createGain();
                this.engineGain.gain.value = 0.0;

                this.engineOsc.connect(filter);
                filter.connect(this.engineGain);
                this.engineGain.connect(this.ctx.destination);
                this.engineOsc.start();

                // Tire screech white-noise loop
                const bufferSize = this.ctx.sampleRate * 1.5;
                const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = noiseBuffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = this.ctx.createBufferSource();
                noise.buffer = noiseBuffer;
                noise.loop = true;

                const screechFilter = this.ctx.createBiquadFilter();
                screechFilter.type = 'bandpass';
                screechFilter.frequency.value = 1150;
                screechFilter.Q.value = 4.5;

                this.screechGain = this.ctx.createGain();
                this.screechGain.gain.value = 0.0;

                noise.connect(screechFilter);
                screechFilter.connect(this.screechGain);
                this.screechGain.connect(this.ctx.destination);
                noise.start();

                this.musicGain = this.ctx.createGain();
                this.musicGain.gain.value = 0.0001;
                this.musicGain.connect(this.ctx.destination);

                this.initialized = true;
            } catch (e) {
                console.warn('Web Audio unavailable:', e);
            }
        }

        startMusic() {
            this.init();
            if (!this.ctx || this.musicTimer) return;
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const melody = [0, 7, 12, 7, 3, 10, 15, 10, 0, 7, 12, 19, 15, 10, 7, 3];
            const bass = [0, 0, -5, -5, -2, -2, -7, -7];
            const scale = [55, 61.74, 65.41, 73.42, 82.41, 98, 110, 123.47, 130.81, 146.83, 164.81, 196, 220, 246.94, 261.63, 293.66, 329.63, 392, 440, 493.88];
            this.musicGain.gain.setTargetAtTime(this.muted ? 0.0001 : 0.12, this.ctx.currentTime, 0.5);
            this.musicTimer = window.setInterval(() => {
                if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
                const now = this.ctx.currentTime;
                const note = scale[melody[this.musicStep % melody.length]];
                const bassNote = 55 * Math.pow(2, bass[Math.floor(this.musicStep / 2) % bass.length] / 12);
                const lead = this.ctx.createOscillator();
                const leadFilter = this.ctx.createBiquadFilter();
                const leadGain = this.ctx.createGain();
                lead.type = 'triangle';
                lead.frequency.setValueAtTime(note, now);
                leadFilter.type = 'lowpass';
                leadFilter.frequency.value = 1800;
                leadGain.gain.setValueAtTime(0.0001, now);
                leadGain.gain.exponentialRampToValueAtTime(0.22, now + 0.025);
                leadGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.31);
                lead.connect(leadFilter);
                leadFilter.connect(leadGain);
                leadGain.connect(this.musicGain);
                lead.start(now);
                lead.stop(now + 0.33);

                if (this.musicStep % 2 === 0) {
                    const low = this.ctx.createOscillator();
                    const lowGain = this.ctx.createGain();
                    low.type = 'sawtooth';
                    low.frequency.setValueAtTime(bassNote, now);
                    lowGain.gain.setValueAtTime(0.0001, now);
                    lowGain.gain.exponentialRampToValueAtTime(0.16, now + 0.025);
                    lowGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
                    low.connect(lowGain);
                    lowGain.connect(this.musicGain);
                    low.start(now);
                    low.stop(now + 0.44);
                }
                this.musicStep++;
            }, 190);
        }

        setMuted(mute) {
            this.muted = mute;
            if (this.initialized) {
                const now = this.ctx.currentTime;
                this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.045, now, 0.05);
                this.screechGain.gain.setTargetAtTime(0, now, 0.05);
                this.musicGain.gain.setTargetAtTime(this.muted ? 0.0001 : 0.12, now, 0.12);
                if (!this.muted && this.ctx.state === 'suspended') this.ctx.resume();
            }
        }

        updateVehicleAudio(speedRatio, isDrifting, activeRace) {
            if (!this.initialized || this.muted) return;
            if (this.ctx.state === 'suspended') this.ctx.resume();

            const now = this.ctx.currentTime;
            if (!activeRace) {
                this.engineGain.gain.setTargetAtTime(0, now, 0.1);
                this.screechGain.gain.setTargetAtTime(0, now, 0.1);
                return;
            }

            // Pitch & volume scale smoothly with speed
            const targetFreq = 52 + Math.abs(speedRatio) * 145;
            const targetVol = 0.045 + Math.abs(speedRatio) * 0.055;
            this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.06);
            this.engineGain.gain.setTargetAtTime(targetVol, now, 0.08);

            // Tire screech on drift
            const screechVol = (isDrifting && Math.abs(speedRatio) > 0.25) ? 0.05 : 0.0;
            this.screechGain.gain.setTargetAtTime(screechVol, now, 0.06);
        }

        playBeep(high = false) {
            this.init();
            this.startMusic();
            if (this.muted) return;
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(high ? 880 : 440, now);
            gain.gain.setValueAtTime(0.14, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + (high ? 0.35 : 0.18));
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + (high ? 0.36 : 0.2));
        }

        playBoost() {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(980, now + 0.28);
            gain.gain.setValueAtTime(0.13, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.31);
        }

        playBump() {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(110, now);
            osc.frequency.exponentialRampToValueAtTime(42, now + 0.12);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.14);
        }
    }

    // -------------------------------------------------------------------------
    // 2. CAR CATALOG & PAINT SWATCHES
    // -------------------------------------------------------------------------

export { SoundEngine };
