class MultiplayerManager {
        constructor(onLobbyUpdate, onRaceStart, onRemoteTelemetry) {
            this.peerId = 'p_' + Math.random().toString(36).substring(2, 9);
            this.roomCode = null;
            this.isHost = false;
            this.players = {}; // peerId -> { id, name, carId, colorHex, isHost, lastSeen }
            this.onLobbyUpdate = onLobbyUpdate;
            this.onRaceStart = onRaceStart;
            this.onRemoteTelemetry = onRemoteTelemetry;

            this.channel = new BroadcastChannel('apex_drift_3d_mp_v1');
            this.channel.onmessage = (ev) => this.handleMessage(ev.data);

            // Heartbeat to keep room presence fresh across tabs
            setInterval(() => {
                if (this.roomCode) {
                    this.pruneStalePlayers();
                    this.broadcast({ type: 'HEARTBEAT', room: this.roomCode, player: this.localProfile });
                }
            }, 1200);
        }

        setLocalProfile(name, carId, colorHex) {
            this.localProfile = {
                id: this.peerId,
                name: name || 'Racer',
                carId,
                colorHex,
                isHost: this.isHost,
                lastSeen: Date.now()
            };
            if (this.roomCode) {
                this.players[this.peerId] = this.localProfile;
                this.persistRoom();
            }
        }

        generateCode() {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
            let code = '';
            for (let i = 0; i < 4; i++) {
                code += chars[Math.floor(Math.random() * chars.length)];
            }
            return code;
        }

        createRoom(name, carId, colorHex) {
            this.roomCode = this.generateCode();
            this.isHost = true;
            this.players = {};
            this.setLocalProfile(name, carId, colorHex);
            this.persistRoom();
            this.onLobbyUpdate(this.roomCode, Object.values(this.players), this.isHost);
            return this.roomCode;
        }

        joinRoom(code, name, carId, colorHex) {
            const clean = (code || '').trim().toUpperCase();
            if (clean.length !== 4) return { ok: false, error: 'Enter a 4-letter room code.' };

            // Check localStorage registry first
            const stored = this.loadRoomFromStorage(clean);
            if (!stored || Object.keys(stored.players || {}).length === 0) {
                return { ok: false, error: `Room "${clean}" not found. Create a room first or check the code.` };
            }
            if (Object.keys(stored.players).length >= 4) {
                return { ok: false, error: 'Room is full (4/4 drivers).' };
            }

            this.roomCode = clean;
            this.isHost = false;
            this.players = stored.players;
            this.setLocalProfile(name, carId, colorHex);
            this.persistRoom();

            this.broadcast({ type: 'JOIN', room: this.roomCode, player: this.localProfile });
            this.onLobbyUpdate(this.roomCode, Object.values(this.players), this.isHost);
            return { ok: true };
        }

        leaveRoom() {
            if (!this.roomCode) return;
            const code = this.roomCode;
            delete this.players[this.peerId];
            this.persistRoom();
            this.broadcast({ type: 'LEAVE', room: code, peerId: this.peerId });
            this.roomCode = null;
            this.isHost = false;
            this.players = {};
        }

        startMultiplayerRace() {
            if (!this.roomCode || !this.isHost) return;
            const roster = Object.values(this.players);
            this.broadcast({ type: 'START_RACE', room: this.roomCode, roster });
            this.onRaceStart(roster);
        }

        sendTelemetry(vehicle) {
            if (!this.roomCode) return;
            this.broadcast({
                type: 'TELEMETRY',
                room: this.roomCode,
                peerId: this.peerId,
                x: vehicle.position.x,
                z: vehicle.position.z,
                heading: vehicle.heading,
                speed: vehicle.speed,
                lap: vehicle.lap,
                totalProgress: vehicle.totalProgress,
                finished: vehicle.finished,
                finishTime: vehicle.finishTime,
                bestLapTime: vehicle.bestLapTime,
                isDrifting: vehicle.isDrifting,
                boostTimer: vehicle.boostTimer
            });
        }

        broadcast(msg) {
            try {
                this.channel.postMessage(msg);
            } catch (e) { /* ignore */ }
        }

        persistRoom() {
            if (!this.roomCode) return;
            try {
                localStorage.setItem('apex_room_' + this.roomCode, JSON.stringify({
                    updatedAt: Date.now(),
                    players: this.players
                }));
            } catch (e) { /* ignore */ }
        }

        loadRoomFromStorage(code) {
            try {
                const raw = localStorage.getItem('apex_room_' + code);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (Date.now() - parsed.updatedAt > 60000) return null;
                return parsed;
            } catch (e) {
                return null;
            }
        }

        pruneStalePlayers() {
            const now = Date.now();
            let changed = false;
            for (const [id, p] of Object.entries(this.players)) {
                if (id !== this.peerId && now - (p.lastSeen || 0) > 6000) {
                    delete this.players[id];
                    changed = true;
                }
            }
            if (changed) {
                this.persistRoom();
                this.onLobbyUpdate(this.roomCode, Object.values(this.players), this.isHost);
            }
        }

        handleMessage(msg) {
            if (!msg || msg.room !== this.roomCode) return;

            if (msg.type === 'JOIN' || msg.type === 'HEARTBEAT') {
                if (msg.player && msg.player.id !== this.peerId) {
                    this.players[msg.player.id] = { ...msg.player, lastSeen: Date.now() };
                    this.persistRoom();
                    this.onLobbyUpdate(this.roomCode, Object.values(this.players), this.isHost);
                }
            } else if (msg.type === 'LEAVE') {
                delete this.players[msg.peerId];
                this.persistRoom();
                this.onLobbyUpdate(this.roomCode, Object.values(this.players), this.isHost);
            } else if (msg.type === 'START_RACE') {
                this.onRaceStart(msg.roster);
            } else if (msg.type === 'TELEMETRY') {
                if (msg.peerId !== this.peerId) {
                    this.onRemoteTelemetry(msg);
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // 6. MAIN GAME ENGINE & UI CONTROLLER
    // -------------------------------------------------------------------------

export { MultiplayerManager };
