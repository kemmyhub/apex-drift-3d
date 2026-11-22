import { SoundEngine } from "../audio/SoundEngine.js";
import { CAR_MODELS, PAINT_COLORS } from "./carCatalog.js";
import { RaceTrack } from "./RaceTrack.js";
import { Vehicle } from "./Vehicle.js";
import { MultiplayerManager } from "../network/MultiplayerManager.js";
import { ProfileManager } from "./ProfileManager.js";
import { UpgradeManager, UPGRADE_TYPES } from "./UpgradeManager.js";
import { AchievementManager } from "./AchievementManager.js";
import { TRACK_CATALOG, getTrackConfig } from "./TrackCatalog.js";
import { PowerUpManager } from "./PowerUpManager.js";

const THREE = window.THREE;

class ApexDriftApp {
        constructor() {
            this.sound = new SoundEngine();
            this.profile = new ProfileManager();
            this.upgrades = new UpgradeManager(this.profile);
            this.achievements = new AchievementManager(this.profile);
            this.selectedCarId = CAR_MODELS[0].id;
            this.selectedColor = PAINT_COLORS[0].hex;
            this.selectedTrackId = localStorage.getItem("apex_track") || "neon-coast";
            if (!TRACK_CATALOG.some(track => track.id === this.selectedTrackId)) this.selectedTrackId = "neon-coast";
            this.mode = 'MENU'; // MENU | COUNTDOWN | RACING | PAUSED | PODIUM
            this.raceType = 'SP'; // SP | TT | MP
            this.vehicles = [];
            this.playerVehicle = null;
            this.raceClock = 0;
            this.lastFrameTime = performance.now();
            this.mpSyncTimer = 0;
            this.personalBestLap = parseFloat(localStorage.getItem('apex_pb_lap') || '0') || Infinity;

            this.input = { up: false, down: false, left: false, right: false, drift: false };

            this.initThree();
            const initialTrack = getTrackConfig(this.selectedTrackId);
            this.scene.background.setHex(initialTrack.skyColor);
            this.scene.fog.color.setHex(initialTrack.fogColor);
            this.scene.fog.density = initialTrack.fogDensity;
            this.track = new RaceTrack(this.scene, this.selectedTrackId);
            this.powerUps = new PowerUpManager(this.scene, this.track, message => { if (message) this.showToast(message); });
            this.buildPreviewShowcase();
            this.initUI();
            this.bindInputs();

            this.mp = new MultiplayerManager(
                (code, players, isHost) => this.renderLobbyRoster(code, players, isHost),
                (roster) => this.startRace('MP', roster),
                (data) => this.applyRemoteTelemetry(data)
            );

            this.animate = this.animate.bind(this);
            requestAnimationFrame(this.animate);
        }

        initThree() {
            this.canvas = document.getElementById('game-canvas');
            this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.graphicsModes = ['ULTRA', 'HIGH', 'PERFORMANCE'];
            this.graphicsMode = localStorage.getItem('apex_graphics') || 'ULTRA';
            if (!this.graphicsModes.includes(this.graphicsMode)) this.graphicsMode = 'ULTRA';
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.18;
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.applyGraphicsMode();

            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x0c192c);
            this.scene.fog = new THREE.FogExp2(0x0c192c, 0.0022);

            this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 950);
            this.camera.position.set(0, 12, 22);

            // Studio + Golden Hour Daylight Lighting
            const hemi = new THREE.HemisphereLight(0xbae6fd, 0x1e293b, 0.85);
            this.scene.add(hemi);

            const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.25);
            dirLight.position.set(120, 180, 90);
            dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 2048;
            dirLight.shadow.mapSize.height = 2048;
            dirLight.shadow.camera.near = 10;
            dirLight.shadow.camera.far = 650;
            const d = 290;
            dirLight.shadow.camera.left = -d;
            dirLight.shadow.camera.right = d;
            dirLight.shadow.camera.top = d;
            dirLight.shadow.camera.bottom = -d;
            this.scene.add(dirLight);

            // Stylized Sky Dome Gradient
            const skyGeo = new THREE.SphereGeometry(620, 24, 16);
            const skyMat = new THREE.MeshBasicMaterial({ color: 0x172a46, side: THREE.BackSide });
            this.scene.add(new THREE.Mesh(skyGeo, skyMat));

            window.addEventListener('resize', () => {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            });
        }

        applyGraphicsMode() {
            if (!this.renderer) return;
            const settings = { ULTRA: { pixelRatio: Math.min(window.devicePixelRatio, 2), shadows: true, shadowType: THREE.PCFSoftShadowMap }, HIGH: { pixelRatio: Math.min(window.devicePixelRatio, 1.5), shadows: true, shadowType: THREE.PCFShadowMap }, PERFORMANCE: { pixelRatio: 1, shadows: false, shadowType: THREE.BasicShadowMap } }[this.graphicsMode];
            this.renderer.setPixelRatio(settings.pixelRatio); this.renderer.shadowMap.enabled = settings.shadows; this.renderer.shadowMap.type = settings.shadowType; this.renderer.setSize(window.innerWidth, window.innerHeight);
            const button = document.getElementById('btn-quality'); if (button) button.textContent = this.graphicsMode;
        }
        cycleGraphicsMode() { const idx = this.graphicsModes.indexOf(this.graphicsMode); this.graphicsMode = this.graphicsModes[(idx + 1) % this.graphicsModes.length]; localStorage.setItem('apex_graphics', this.graphicsMode); this.applyGraphicsMode(); this.showToast('Graphics set to ' + this.graphicsMode); }

        changeTrack(trackId) {
            if (!TRACK_CATALOG.some(track => track.id === trackId) || trackId === this.selectedTrackId) return;
            if (this.showcaseCar) { this.showcaseCar.dispose(); this.showcaseCar = null; }
            if (this.powerUps) this.powerUps.dispose();
            if (this.track) this.track.dispose();
            this.selectedTrackId = trackId;
            localStorage.setItem("apex_track", trackId);
            const config = getTrackConfig(trackId);
            this.scene.background.setHex(config.skyColor);
            this.scene.fog.color.setHex(config.fogColor);
            this.scene.fog.density = config.fogDensity;
            this.track = new RaceTrack(this.scene, trackId);
            this.powerUps = new PowerUpManager(this.scene, this.track, message => { if (message) this.showToast(message); });
            this.buildPreviewShowcase();
            this.showToast(config.name + " selected");
        }

        buildPreviewShowcase() {
            if (this.showcaseCar) {
                this.showcaseCar.dispose();
            }
            this.showcaseCar = new Vehicle(this.scene, this.track, {
                id: 'preview',
                name: 'Preview',
                carId: this.selectedCarId,
                colorHex: this.selectedColor,
                carSpec: this.upgrades.applyToSpec(CAR_MODELS.find(car => car.id === this.selectedCarId) || CAR_MODELS[0], this.selectedCarId)
            });
            this.showcaseCar.position.set(0, 0, 0);
            this.showcaseCar.heading = 0.5;
            this.showcaseCar.syncMeshTransform(0);
        }

        initUI() {
            // Paint Swatches
            const swatchContainer = document.getElementById('color-swatches');
            PAINT_COLORS.forEach(c => {
                const btn = document.createElement('button');
                btn.className = 'w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 transition transform hover:scale-110 cursor-pointer';
                btn.style.backgroundColor = c.hex;
                btn.style.borderColor = c.hex === this.selectedColor ? '#ffffff' : 'transparent';
                btn.title = c.name;
                btn.onclick = () => {
                    this.selectedColor = c.hex;
                    Array.from(swatchContainer.children).forEach(el => el.style.borderColor = 'transparent');
                    btn.style.borderColor = '#ffffff';
                    this.buildPreviewShowcase();
                    this.sound.playBeep(false);
                };
                swatchContainer.appendChild(btn);
            });

            // Car Selection Cards
            const carCards = document.getElementById('car-cards');
            const renderCarCards = () => {
                carCards.innerHTML = '';
                CAR_MODELS.forEach(car => {
                    const active = car.id === this.selectedCarId;
                    const card = document.createElement('button');
                    card.className = `p-3 rounded-2xl border text-left transition cursor-pointer ${
                        active
                            ? 'bg-sky-500/20 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
                            : 'bg-slate-900/75 border-slate-800 hover:border-slate-600'
                    }`;
                    card.innerHTML = `
                        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-sky-300">${car.tag}</span>
                        <div class="font-racing text-xs sm:text-sm font-black text-white mt-1.5">${car.name}</div>
                    `;
                    card.onclick = () => {
                        this.selectedCarId = car.id;
                        renderCarCards();
                        this.updateStatBars(this.upgrades.applyToSpec(car, car.id));
                        this.renderUpgradePanel();
                        this.buildPreviewShowcase();
                        this.sound.playBeep(false);
                    };
                    carCards.appendChild(card);
                });
            };
            renderCarCards();
            this.updateStatBars(this.upgrades.applyToSpec(CAR_MODELS[0], this.selectedCarId));
            this.renderUpgradePanel();
            this.refreshBestLapBadge();
            this.refreshProfileUI();
            ["engine", "handling", "nitro"].forEach(type => {
                const button = document.getElementById("upgrade-" + type);
                if (button) button.onclick = () => this.buyUpgrade(type);
            });

            // Track selection
            const trackSelect = document.getElementById("track-select");
            trackSelect.innerHTML = TRACK_CATALOG.map(track => "<option value=\"" + track.id + "\">" + track.name + " · " + track.location + "</option>").join("");
            trackSelect.value = this.selectedTrackId;
            trackSelect.onchange = event => this.changeTrack(event.target.value);

            // Graphics quality selector
            document.getElementById('btn-quality').onclick = () => this.cycleGraphicsMode();

            // Mute Toggle
            document.getElementById('btn-mute').onclick = () => {
                this.sound.init();
                this.sound.setMuted(!this.sound.muted);
                document.getElementById('icon-sound-on').classList.toggle('hidden', this.sound.muted);
                document.getElementById('icon-sound-off').classList.toggle('hidden', !this.sound.muted);
            };

            // Career overview and race pause controls
            const careerButton = document.getElementById('btn-open-career');
            if (careerButton) careerButton.onclick = () => this.openCareer();
            const closeCareer = document.getElementById('btn-close-career');
            if (closeCareer) closeCareer.onclick = () => document.getElementById('ui-career').classList.add('hidden');
            const resumeButton = document.getElementById('btn-resume-race');
            if (resumeButton) resumeButton.onclick = () => this.resumeRace();
            const restartButton = document.getElementById('btn-restart-race');
            if (restartButton) restartButton.onclick = () => { const type = this.raceType; const roster = type === 'MP' ? Object.values(this.mp.players) : []; this.returnToMenu(); this.startRace(type, roster); };
            const pauseQuit = document.getElementById('btn-pause-quit');
            if (pauseQuit) pauseQuit.onclick = () => this.returnToMenu();
            const pauseButton = document.getElementById('btn-pause-race');
            if (pauseButton) pauseButton.onclick = () => this.togglePause();
            const weaponButton = document.getElementById('btn-use-weapon');
            if (weaponButton) weaponButton.onclick = () => { if (this.mode === 'RACING' && this.playerVehicle && this.powerUps) this.powerUps.activate(this.playerVehicle, this.vehicles); };

            // Single Player & Time Trial Launchers
            document.getElementById('btn-start-sp').onclick = () => {
                this.sound.init();
                this.startRace('SP');
            };
            document.getElementById('btn-start-tt').onclick = () => {
                this.sound.init();
                this.startRace('TT');
            };

            // Multiplayer Modal Controls
            document.getElementById('btn-open-mp').onclick = () => {
                this.sound.init();
                document.getElementById('ui-mp-lobby').classList.remove('hidden');
                document.getElementById('mp-step-connect').classList.remove('hidden');
                document.getElementById('mp-step-room').classList.add('hidden');
                document.getElementById('mp-error-msg').classList.add('hidden');
            };

            document.getElementById('btn-close-mp').onclick = () => {
                this.mp.leaveRoom();
                document.getElementById('ui-mp-lobby').classList.add('hidden');
            };

            document.getElementById('btn-create-room').onclick = () => {
                const name = document.getElementById('input-player-name').value.trim() || 'Host_01';
                this.mp.createRoom(name, this.selectedCarId, this.selectedColor);
                document.getElementById('mp-step-connect').classList.add('hidden');
                document.getElementById('mp-step-room').classList.remove('hidden');
                this.sound.playBeep(true);
            };

            document.getElementById('btn-join-room').onclick = () => {
                const code = document.getElementById('input-room-code').value;
                const name = document.getElementById('input-player-name').value.trim() || 'Guest_02';
                const res = this.mp.joinRoom(code, name, this.selectedCarId, this.selectedColor);
                const errEl = document.getElementById('mp-error-msg');
                if (!res.ok) {
                    errEl.textContent = res.error;
                    errEl.classList.remove('hidden');
                    return;
                }
                errEl.classList.add('hidden');
                document.getElementById('mp-step-connect').classList.add('hidden');
                document.getElementById('mp-step-room').classList.remove('hidden');
                this.sound.playBeep(true);
            };

            document.getElementById('btn-copy-code').onclick = () => {
                const code = document.getElementById('lobby-room-code').textContent;
                const temp = document.createElement('textarea');
                temp.value = code;
                document.body.appendChild(temp);
                temp.select();
                document.execCommand('copy');
                document.body.removeChild(temp);
                this.showToast(`Room code ${code} copied to clipboard!`);
            };

            document.getElementById('btn-leave-room').onclick = () => {
                this.mp.leaveRoom();
                document.getElementById('mp-step-room').classList.add('hidden');
                document.getElementById('mp-step-connect').classList.remove('hidden');
            };

            document.getElementById('btn-mp-start').onclick = () => {
                this.mp.startMultiplayerRace();
            };

            // Quit / Post-Race Buttons
            document.getElementById('btn-exit-race').onclick = () => this.returnToMenu();
            document.getElementById('btn-return-menu').onclick = () => this.returnToMenu();
            document.getElementById('btn-play-again').onclick = () => {
                document.getElementById('ui-podium').classList.add('hidden');
                if (this.raceType === 'MP') {
                    this.startRace('MP', Object.values(this.mp.players));
                } else {
                    this.startRace(this.raceType);
                }
            };
        }

        updateStatBars(car) {
            document.getElementById('stat-speed-val').textContent = car.stats.speed;
            document.getElementById('stat-speed-bar').style.width = car.stats.speed + '%';
            document.getElementById('stat-accel-val').textContent = car.stats.accel;
            document.getElementById('stat-accel-bar').style.width = car.stats.accel + '%';
            document.getElementById('stat-handling-val').textContent = car.stats.handling;
            document.getElementById('stat-handling-bar').style.width = car.stats.handling + '%';
        }

        renderUpgradePanel() {
            const container = document.getElementById("upgrade-list");
            if (!container || !this.upgrades) return;
            const levels = this.upgrades.levels(this.selectedCarId);
            container.innerHTML = Object.keys(UPGRADE_TYPES).map(type => {
                const config = UPGRADE_TYPES[type];
                const level = levels[type];
                const cost = this.upgrades.nextCost(this.selectedCarId, type);
                const maxed = cost === null;
                const canAfford = !maxed && this.profile.data.credits >= cost;
                const detail = type === "engine" ? "Top speed and acceleration" : type === "handling" ? "Cornering response and grip" : "Longer turbo boost duration";
                return `<div class="flex items-center gap-3 rounded-xl bg-slate-900/80 border border-slate-800 p-3">
                    <div class="min-w-0 flex-1"><div class="flex items-center justify-between gap-2"><span class="text-xs font-bold text-white">${config.label}</span><span class="text-[10px] font-racing text-sky-300">LV ${level}/5</span></div><div class="text-[10px] text-slate-500 mt-0.5">${detail}</div><div class="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2"><div class="h-full bg-gradient-to-r from-sky-500 to-cyan-300" style="width:${level * 20}%"></div></div></div>
                    <button id="upgrade-${type}" ${maxed || !canAfford ? "disabled" : ""} class="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider ${maxed ? "bg-slate-800 text-slate-500" : canAfford ? "bg-sky-500 text-slate-950 hover:bg-sky-400" : "bg-slate-800 text-slate-500"} disabled:opacity-60">${maxed ? "MAX" : cost.toLocaleString() + " CR"}</button>
                </div>`;
            }).join("");
            Object.keys(UPGRADE_TYPES).forEach(type => {
                const button = document.getElementById("upgrade-" + type);
                if (button && !button.disabled) button.onclick = () => this.buyUpgrade(type);
            });
        }

        buyUpgrade(type) {
            const result = this.upgrades.purchase(this.selectedCarId, type);
            if (!result.ok) { this.showToast(result.reason); return; }
            const base = CAR_MODELS.find(car => car.id === this.selectedCarId) || CAR_MODELS[0];
            this.updateStatBars(this.upgrades.applyToSpec(base, this.selectedCarId));
            this.buildPreviewShowcase();
            this.refreshProfileUI();
            this.renderUpgradePanel();
            this.showToast(`${UPGRADE_TYPES[type].label} upgraded to level ${result.level}`);
            this.sound.playBeep(true);
        }

        refreshBestLapBadge() {
            const txt = isFinite(this.personalBestLap) ? this.formatTime(this.personalBestLap) : '--:--.--';
            document.getElementById('best-lap-badge').textContent = `Best Lap: ${txt}`;
        }

        refreshProfileUI() {
            const p = this.profile.data;
            const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
            set("profile-level", this.profile.level);
            set("profile-credits", p.credits.toLocaleString());
            set("profile-races", p.races.toLocaleString());
            set("profile-wins", p.wins.toLocaleString());
            set("profile-xp-label", `${p.xp.toLocaleString()} / ${this.profile.nextLevelXP.toLocaleString()} XP`);
            const bar = document.getElementById("profile-xp-bar");
            if (bar) bar.style.width = `${this.profile.levelProgress}%`;
        }

        renderLobbyRoster(code, players, isHost) {
            document.getElementById('lobby-room-code').textContent = code;
            document.getElementById('lobby-player-count').textContent = `${players.length} / 4`;

            const list = document.getElementById('lobby-player-list');
            list.innerHTML = '';
            players.forEach(p => {
                const car = CAR_MODELS.find(c => c.id === p.carId) || CAR_MODELS[0];
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between bg-slate-900/90 border border-slate-800 px-3.5 py-2.5 rounded-xl';
                row.innerHTML = `
                    <div class="flex items-center gap-2.5">
                        <span class="w-3.5 h-3.5 rounded-full" style="background:${p.colorHex}"></span>
                        <span class="font-bold text-sm text-white">${p.name}</span>
                        ${p.isHost ? '<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">HOST</span>' : ''}
                    </div>
                    <span class="text-xs font-racing text-slate-400">${car.name}</span>
                `;
                list.appendChild(row);
            });

            const startBtn = document.getElementById('btn-mp-start');
            if (isHost) {
                startBtn.disabled = false;
                startBtn.textContent = '🚀 Start Race';
                startBtn.classList.remove('opacity-50');
            } else {
                startBtn.disabled = true;
                startBtn.textContent = 'Waiting for Host...';
                startBtn.classList.add('opacity-50');
            }
        }

        bindInputs() {
            const setKey = (code, state) => {
                if (code === 'KeyW' || code === 'ArrowUp') this.input.up = state;
                if (code === 'KeyS' || code === 'ArrowDown') this.input.down = state;
                if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = state;
                if (code === 'KeyD' || code === 'ArrowRight') this.input.right = state;
                if (code === 'Space') this.input.drift = state;
                if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.boost = state;
                if (state && code === 'KeyF' && this.mode === 'RACING' && this.playerVehicle && this.powerUps) this.powerUps.activate(this.playerVehicle, this.vehicles);
                if (state && code === 'KeyR' && this.mode === 'RACING' && this.playerVehicle) {
                    this.playerVehicle.resetToTrack();
                    this.showToast('Car repositioned onto track');
                }
            };

            window.addEventListener('keydown', e => {
                if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
                if (e.code === 'KeyF') e.preventDefault();
                if ((e.code === 'Escape' || e.code === 'KeyP') && ['RACING', 'PAUSED'].includes(this.mode)) { e.preventDefault(); this.togglePause(); return; }
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                    e.preventDefault();
                }
                setKey(e.code, true);
            });
            window.addEventListener('keyup', e => setKey(e.code, false));

            // Mobile Touch Controls
            const bindTouch = (id, key) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('touchstart', e => { e.preventDefault(); this.input[key] = true; });
                el.addEventListener('touchend', e => { e.preventDefault(); this.input[key] = false; });
            };
            bindTouch('touch-left', 'left');
            bindTouch('touch-right', 'right');
            bindTouch('touch-drift', 'drift');
            bindTouch('touch-gas', 'up');
            bindTouch('touch-boost', 'boost');
        }

        openCareer() {
            const panel = document.getElementById('career-content');
            if (!panel) return;
            const p = this.profile.data;
            const achievements = this.achievements.all;
            const unlocked = achievements.filter(item => item.unlocked).length;
            const best = p.bestLap ? this.formatTime(p.bestLap) : '--:--.--';
            const carRows = CAR_MODELS.map(car => {
                const levels = this.upgrades.levels(car.id);
                const total = levels.engine + levels.handling + levels.nitro;
                return `<div class="career-car"><div><strong>${car.name}</strong><span>${total}/15 upgrade levels</span></div><div class="career-mini-track"><i style="width:${total / 15 * 100}%"></i></div></div>`;
            }).join('');
            panel.innerHTML = `<div class="career-stats">
                <div><span>DRIVER LEVEL</span><strong>${this.profile.level}</strong></div>
                <div><span>RACE WINS</span><strong>${p.wins.toLocaleString()}</strong></div>
                <div><span>PODIUMS</span><strong>${p.podiums.toLocaleString()}</strong></div>
                <div><span>RACES</span><strong>${p.races.toLocaleString()}</strong></div>
                <div><span>LIFETIME DRIFT</span><strong>${p.totalDriftPoints.toLocaleString()}</strong></div>
                <div><span>BEST LAP</span><strong>${best}</strong></div>
            </div>
            <div class="career-section"><div class="career-section-title"><h3>DRIVER PROGRESSION</h3><span>${p.xp.toLocaleString()} / ${this.profile.nextLevelXP.toLocaleString()} XP</span></div><div class="career-progress"><i style="width:${this.profile.levelProgress}%"></i></div><p>${p.credits.toLocaleString()} credits available for garage upgrades</p></div>
            <div class="career-section"><div class="career-section-title"><h3>ACHIEVEMENTS</h3><span>${unlocked} / ${achievements.length} UNLOCKED</span></div><div class="career-achievements">${achievements.map(item => `<article class="${item.unlocked ? 'is-unlocked' : 'is-locked'}"><div class="achievement-mark">${item.unlocked ? '★' : '◇'}</div><div><strong>${item.name}</strong><p>${item.description}</p></div><b>+${item.reward} CR</b></article>`).join('')}</div></div>
            <div class="career-section"><div class="career-section-title"><h3>GARAGE DEVELOPMENT</h3><span>UPGRADES BY CAR</span></div><div class="career-cars">${carRows}</div></div>`;
            document.getElementById('ui-career').classList.remove('hidden');
        }

        togglePause() {
            if (this.mode === 'RACING' || this.mode === 'COUNTDOWN') {
                this.modeBeforePause = this.mode;
                this.mode = 'PAUSED';
                this.input = { up:false, down:false, left:false, right:false, drift:false, boost:false };
                document.getElementById('ui-pause').classList.remove('hidden');
                document.getElementById('btn-pause-race')?.classList.add('hidden');
                this.sound.updateVehicleAudio(0, false, false);
            } else if (this.mode === 'PAUSED') this.resumeRace();
        }

        resumeRace() {
            if (this.mode !== 'PAUSED') return;
            this.mode = this.modeBeforePause === 'COUNTDOWN' ? 'RACING' : 'RACING';
            document.getElementById('ui-pause').classList.add('hidden');
            document.getElementById('btn-pause-race')?.classList.remove('hidden');
        }

        startRace(type, mpRoster = []) {
            this.raceType = type;
            this.clearVehicles();
            if (this.powerUps) this.powerUps.dispose();
            this.powerUps = new PowerUpManager(this.scene, this.track, message => { if (message) this.showToast(message); });

            if (this.showcaseCar) {
                this.showcaseCar.dispose();
                this.showcaseCar = null;
            }

            const playerName = document.getElementById('input-player-name').value.trim() || 'Racer_01';

            if (type === 'MP') {
                // Spawn local + connected multiplayer cars
                mpRoster.forEach((p, idx) => {
                    const isLocal = p.id === this.mp.peerId;
                    const v = new Vehicle(this.scene, this.track, {
                        id: p.id,
                        name: p.name,
                        carId: p.carId,
                        colorHex: p.colorHex,
                        isPlayer: isLocal,
                        isRemote: !isLocal
                    });
                    v.placeOnGrid(idx);
                    this.vehicles.push(v);
                    if (isLocal) this.playerVehicle = v;
                });
            } else {
                // Spawn Player Car on Pole
                this.playerVehicle = new Vehicle(this.scene, this.track, {
                    id: 'local_player',
                    name: playerName,
                    carId: this.selectedCarId,
                    colorHex: this.selectedColor,
                    carSpec: this.upgrades.applyToSpec(CAR_MODELS.find(car => car.id === this.selectedCarId) || CAR_MODELS[0], this.selectedCarId),
                    isPlayer: true
                });
                this.playerVehicle.placeOnGrid(0);
                this.vehicles.push(this.playerVehicle);

                // Spawn 3 AI Opponents if Single Player
                if (type === 'SP') {
                    const bots = [
                        { name: 'APEX_BOT', carId: 'apex', colorHex: '#ef4444', aiSkill: 0.94 },
                        { name: 'DRIFT_KAI', carId: 'drift', colorHex: '#f59e0b', aiSkill: 0.89 },
                        { name: 'NOVA_AI', carId: 'viper', colorHex: '#8b5cf6', aiSkill: 0.84 }
                    ];
                    bots.forEach((b, i) => {
                        const ai = new Vehicle(this.scene, this.track, {
                            id: 'ai_' + i,
                            name: b.name,
                            carId: b.carId,
                            colorHex: b.colorHex,
                            isAI: true,
                            aiSkill: b.aiSkill
                        });
                        ai.placeOnGrid(i + 1);
                        this.vehicles.push(ai);
                    });
                }
            }

            // Switch UI Screens
            document.getElementById('ui-main-menu').classList.add('hidden');
            document.getElementById('ui-mp-lobby').classList.add('hidden');
            document.getElementById('ui-podium').classList.add('hidden');
            document.getElementById('ui-pause').classList.add('hidden');
            document.getElementById('btn-pause-race')?.classList.remove('hidden');
            document.getElementById('ui-race-hud').classList.remove('hidden');
            document.getElementById('btn-exit-race').classList.remove('hidden');
            document.getElementById('btn-pause-race')?.classList.remove('hidden');

            document.getElementById('hud-total-cars').textContent = `/${this.vehicles.length}`;
            document.getElementById('hud-best-lap').textContent = isFinite(this.personalBestLap)
                ? this.formatTime(this.personalBestLap)
                : '--:--.--';

            this.runCountdown();
        }

        runCountdown() {
            this.mode = 'COUNTDOWN';
            const cdEl = document.getElementById('hud-countdown');
            cdEl.classList.remove('hidden');

            const steps = ['3', '2', '1', 'GO!'];
            let idx = 0;

            const tick = () => {
                if (this.mode !== 'COUNTDOWN') return;
                const label = steps[idx];
                cdEl.textContent = label;
                cdEl.classList.remove('countdown-anim');
                void cdEl.offsetWidth;
                cdEl.classList.add('countdown-anim');

                const isGo = label === 'GO!';
                this.sound.playBeep(isGo);

                if (isGo) {
                    this.mode = 'RACING';
                    this.raceClock = 0;
                    this.vehicles.forEach(v => v.currentLapStart = 0);
                    setTimeout(() => cdEl.classList.add('hidden'), 650);
                } else {
                    idx++;
                    setTimeout(tick, 850);
                }
            };
            tick();
        }

        applyRemoteTelemetry(data) {
            const remote = this.vehicles.find(v => v.id === data.peerId);
            if (!remote) return;
            remote.remoteTargetPos = new THREE.Vector3(data.x, 0, data.z);
            remote.remoteTargetHeading = data.heading;
            remote.speed = data.speed;
            remote.lap = data.lap;
            remote.totalProgress = data.totalProgress;
            remote.finished = data.finished;
            remote.finishTime = data.finishTime;
            remote.bestLapTime = data.bestLapTime;
            remote.isDrifting = data.isDrifting;
            remote.boostTimer = data.boostTimer;
        }

        clearVehicles() {
            this.vehicles.forEach(v => v.dispose());
            this.vehicles = [];
            this.playerVehicle = null;
        }

        returnToMenu() {
            this.mode = 'MENU';
            document.getElementById('ui-pause')?.classList.add('hidden');
            document.getElementById('btn-pause-race')?.classList.remove('hidden');
            this.sound.updateVehicleAudio(0, false, false);
            this.clearVehicles();
            this.mp.leaveRoom();

            document.getElementById('ui-race-hud').classList.add('hidden');
            document.getElementById('ui-podium').classList.add('hidden');
            document.getElementById('ui-mp-lobby').classList.add('hidden');
            document.getElementById('btn-exit-race').classList.add('hidden');
            document.getElementById('ui-main-menu').classList.remove('hidden');

            this.refreshBestLapBadge();
            this.refreshProfileUI();
            this.buildPreviewShowcase();
        }

        showPodium() {
            if (this.mode === 'PODIUM') return;
            this.mode = 'PODIUM';
            this.sound.updateVehicleAudio(0, false, false);

            // Save personal best lap if broken
            if (this.playerVehicle && this.playerVehicle.bestLapTime < this.personalBestLap) {
                this.personalBestLap = this.playerVehicle.bestLapTime;
                localStorage.setItem('apex_pb_lap', String(this.personalBestLap));
            }

            // Sort standings: finished cars by finishTime, active cars by totalProgress
            const sorted = [...this.vehicles].sort((a, b) => {
                if (a.finished && b.finished) return a.finishTime - b.finishTime;
                if (a.finished) return -1;
                if (b.finished) return 1;
                return b.totalProgress - a.totalProgress;
            });

            const playerPosition = sorted.findIndex(v => v.isPlayer) + 1;
            const reward = this.profile.recordRace({
                position: playerPosition || sorted.length,
                driftPoints: this.playerVehicle ? this.playerVehicle.driftScore : 0,
                bestLap: this.playerVehicle ? this.playerVehicle.bestLapTime : null,
                mode: this.raceType
            });
            const unlockedAchievements = this.achievements.evaluate();
            const rewardEl = document.getElementById("podium-rewards");
            if (rewardEl) {
                rewardEl.innerHTML = '<div class="flex flex-wrap justify-center gap-3 text-sm font-bold">' +
                    '<span class="rounded-xl bg-sky-500/15 border border-sky-400/30 px-4 py-2 text-sky-200">+' + reward.xpEarned + ' XP</span>' +
                    '<span class="rounded-xl bg-amber-500/15 border border-amber-400/30 px-4 py-2 text-amber-200">+' + reward.creditsEarned + ' CREDITS</span>' +
                    '<span class="rounded-xl bg-fuchsia-500/15 border border-fuchsia-400/30 px-4 py-2 text-fuchsia-200">LEVEL ' + reward.level + '</span>' +
                    '</div><p class="mt-2 text-xs text-slate-400">' +
                    (reward.leveledUp ? 'LEVEL UP! Your driver rank has increased.' : 'Rewards saved to your driver profile.') + '</p>';
            }
            this.refreshProfileUI();
            const achievementEl = document.getElementById('podium-achievements');
            if (achievementEl) {
                achievementEl.innerHTML = unlockedAchievements.map(item =>
                    '<div class="flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-left"><div><div class="text-xs font-bold text-amber-200">ACHIEVEMENT UNLOCKED · ' + item.name + '</div><div class="text-[10px] text-slate-400">' + item.description + '</div></div><span class="shrink-0 text-xs font-black text-amber-300">+' + item.reward + ' CR</span></div>'
                ).join('');
            }

            const container = document.getElementById('podium-results');
            container.innerHTML = '';

            sorted.forEach((v, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                const totalStr = v.finished ? this.formatTime(v.finishTime) : this.formatTime(this.raceClock);
                const bestStr = isFinite(v.bestLapTime) ? this.formatTime(v.bestLapTime) : '--:--.--';

                const row = document.createElement('div');
                row.className = `flex items-center justify-between px-4 py-3 rounded-2xl border ${
                    v.isPlayer
                        ? 'bg-sky-500/20 border-sky-400'
                        : 'bg-slate-900/85 border-slate-800'
                }`;
                row.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="font-racing text-lg font-black w-8">${medal}</span>
                        <span class="w-3.5 h-3.5 rounded-full" style="background:${v.colorHex}"></span>
                        <div>
                            <div class="font-bold text-sm text-white">${v.name} ${v.isPlayer ? '(YOU)' : ''}</div>
                            <div class="text-[11px] text-slate-400">${v.carSpec.name}</div>
                        </div>
                    </div>
                    <div class="text-right font-racing">
                        <div class="text-sm font-bold text-white">${totalStr}</div>
                        <div class="text-[11px] text-emerald-400">Best: ${bestStr}</div>
                    </div>
                `;
                container.appendChild(row);
            });

            document.getElementById('ui-race-hud').classList.add('hidden');
            document.getElementById('ui-podium').classList.remove('hidden');
        }

        updateHUD() {
            if (!this.playerVehicle) return;
            const pv = this.playerVehicle;

            // Speedometer (scaled to arcade KM/H)
            const kmh = Math.round(Math.abs(pv.speed) * 2.85);
            document.getElementById('hud-speed').textContent = kmh;

            const rpmPct = Math.min(100, (Math.abs(pv.speed) / pv.carSpec.maxSpeed) * 100);
            document.getElementById('hud-rpm-bar').style.width = rpmPct + '%';
            document.getElementById('hud-nitro-bar').style.width = pv.nitroCharge + '%';
            document.getElementById('hud-nitro-value').textContent = Math.round(pv.nitroCharge) + '%';
            const weaponName = pv.weapon ? ({ missile: 'MISSILE', shield: 'SHIELD', shockwave: 'SHOCKWAVE', nitro: 'TURBO CELL' }[pv.weapon] || pv.weapon.toUpperCase()) : 'NO WEAPON';
            const weaponLabel = document.getElementById('hud-weapon-name');
            const weaponButton = document.getElementById('btn-use-weapon');
            if (weaponLabel) weaponLabel.textContent = weaponName;
            if (weaponButton) { weaponButton.disabled = !pv.weapon; weaponButton.classList.toggle('weapon-ready', !!pv.weapon); }
            document.getElementById('hud-drift-score').textContent = pv.driftScore.toLocaleString();
            document.body.classList.toggle('boosting', pv.boostTimer > 0);

            document.getElementById('hud-drift-tag').style.opacity = pv.isDrifting ? '1' : '0';
            document.getElementById('hud-boost-tag').style.opacity = pv.boostTimer > 0 ? '1' : '0';

            // Current Position
            const sorted = [...this.vehicles].sort((a, b) => b.totalProgress - a.totalProgress);
            const rank = sorted.indexOf(pv) + 1;
            const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
            document.getElementById('hud-pos').textContent = `${rank}${suffix}`;

            // Lap & Timers
            document.getElementById('hud-lap').textContent = pv.lap;
            const currentLapElapsed = this.mode === 'RACING' ? (this.raceClock - pv.currentLapStart) : 0;
            document.getElementById('hud-lap-time').textContent = this.formatTime(Math.max(0, currentLapElapsed));

            const bestDisplay = Math.min(pv.bestLapTime, this.personalBestLap);
            if (isFinite(bestDisplay)) {
                document.getElementById('hud-best-lap').textContent = this.formatTime(bestDisplay);
            }

            // Draw Minimap
            this.renderMinimap();
        }

        renderMinimap() {
            const canvas = document.getElementById('minimap-canvas');
            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            // Track bounds mapping (-60..290 X, -290..280 Z)
            const mapX = x => ((x + 65) / 375) * (w - 24) + 12;
            const mapY = z => ((z + 295) / 590) * (h - 24) + 12;

            // Draw circuit loop
            ctx.beginPath();
            this.track.curvePoints.forEach((pt, i) => {
                if (i % 3 !== 0) return;
                const px = mapX(pt.x);
                const py = mapY(pt.z);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.closePath();
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
            ctx.lineWidth = 6;
            ctx.stroke();

            // Start line dot
            const startPt = this.track.curvePoints[0];
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(mapX(startPt.x) - 4, mapY(startPt.z) - 2, 8, 4);

            // Draw vehicles
            for (const v of this.vehicles) {
                ctx.beginPath();
                ctx.arc(mapX(v.position.x), mapY(v.position.z), v.isPlayer ? 5 : 3.8, 0, Math.PI * 2);
                ctx.fillStyle = v.isPlayer ? '#38bdf8' : v.colorHex;
                ctx.fill();
                if (v.isPlayer) {
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
            }
        }

        updateCamera(dt) {
            if (this.mode === 'MENU' && this.showcaseCar) {
                // Orbiting garage showcase camera
                const t = performance.now() * 0.00055;
                this.camera.position.set(
                    this.showcaseCar.position.x + Math.sin(t) * 8.5,
                    3.8,
                    this.showcaseCar.position.z + Math.cos(t) * 8.5
                );
                this.camera.lookAt(this.showcaseCar.position.x, 1.1, this.showcaseCar.position.z);
                return;
            }

            if (!this.playerVehicle) return;
            const pv = this.playerVehicle;

            // Dynamic chase camera pulls back & widens FOV during boost
            const boosting = pv.boostTimer > 0;
            const targetFov = boosting ? 82 : (Math.abs(pv.speed) > 65 ? 68 : 62);
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 6);
            this.camera.updateProjectionMatrix();

            const chaseDist = boosting ? 11.2 : 9.2;
            const chaseHeight = boosting ? 4.4 : 3.9;
            const backVec = new THREE.Vector3(-Math.sin(pv.heading), 0, -Math.cos(pv.heading));
            const desiredPos = pv.position.clone()
                .addScaledVector(backVec, chaseDist)
                .add(new THREE.Vector3(0, chaseHeight, 0));

            this.camera.position.lerp(desiredPos, Math.min(1, dt * 10));

            const lookTarget = pv.position.clone()
                .addScaledVector(backVec, -6)
                .add(new THREE.Vector3(0, 1.3, 0));
            this.camera.lookAt(lookTarget);
        }

        formatTime(sec) {
            const mins = Math.floor(sec / 60);
            const rem = sec % 60;
            const whole = Math.floor(rem);
            const ms = Math.floor((rem - whole) * 100);
            return `${String(mins).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
        }

        showToast(text) {
            const box = document.getElementById('toast-box');
            document.getElementById('toast-text').textContent = text;
            box.classList.remove('opacity-0');
            clearTimeout(this.toastTimeout);
            this.toastTimeout = setTimeout(() => box.classList.add('opacity-0'), 2400);
        }

        animate(now) {
            requestAnimationFrame(this.animate);
            const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
            this.lastFrameTime = now;

            if (this.mode === 'RACING') {
                this.raceClock += dt;
            }

            const activeRace = this.mode === 'RACING';
            if (this.mode !== 'PAUSED') {
                if (this.powerUps && activeRace) this.powerUps.update(dt, this.vehicles, this.raceClock);
                for (const v of this.vehicles) {
                    v.update(dt, this.input, this.vehicles, activeRace, this.raceClock, this.sound);
                }
            }

            // Broadcast local player telemetry in Multiplayer mode
            if (this.raceType === 'MP' && this.playerVehicle && (this.mode === 'RACING' || this.mode === 'COUNTDOWN')) {
                this.mpSyncTimer += dt;
                if (this.mpSyncTimer >= 0.04) {
                    this.mpSyncTimer = 0;
                    this.mp.sendTelemetry(this.playerVehicle);
                }
            }

            // Engine & tire screech sound synthesis
            if (this.playerVehicle && (this.mode === 'RACING' || this.mode === 'COUNTDOWN')) {
                const speedRatio = this.playerVehicle.speed / this.playerVehicle.carSpec.maxSpeed;
                this.sound.updateVehicleAudio(speedRatio, this.playerVehicle.isDrifting, true);
                this.updateHUD();

                // Check player finish condition
                if (this.mode === 'RACING' && this.playerVehicle.finished) {
                    this.showPodium();
                }
            }

            this.updateCamera(dt);
            this.renderer.render(this.scene, this.camera);
        }
    }

export { ApexDriftApp };
