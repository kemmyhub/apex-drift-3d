import { CAR_MODELS } from "./carCatalog.js";

const THREE = window.THREE;

class Vehicle {
        constructor(scene, track, options) {
            this.scene = scene;
            this.track = track;
            this.id = options.id;
            this.name = options.name;
            this.isPlayer = !!options.isPlayer;
            this.isAI = !!options.isAI;
            this.isRemote = !!options.isRemote;
            this.carSpec = CAR_MODELS.find(c => c.id === options.carId) || CAR_MODELS[0];
            this.colorHex = options.colorHex || '#0ea5e9';
            this.aiSkill = options.aiSkill || 0.9;

            // Physics State
            this.position = new THREE.Vector3();
            this.velocity = new THREE.Vector3();
            this.heading = 0; // Radians
            this.speed = 0;
            this.steerAngle = 0;
            this.isDrifting = false;
            this.boostTimer = 0;
            this.nitroCharge = 0;
            this.driftScore = 0;
            this.visualRoll = 0;

            // Race Progress State
            this.lap = 1;
            this.nextCheckpoint = 1;
            this.trackT = 0;
            this.totalProgress = 0;
            this.finished = false;
            this.finishTime = 0;
            this.currentLapStart = 0;
            this.bestLapTime = Infinity;

            // AI Navigation
            this.aiTargetT = 0.03;
            this.aiLaneOffset = (Math.random() - 0.5) * 8;

            // Visual Effects Buffers
            this.skidMarks = [];
            this.skidTimer = 0;
            this.boostParticles = [];

            this.mesh = this.createCarMesh();
            this.scene.add(this.mesh);
        }

        createCarMesh() {
            const root = new THREE.Group();
            const paintMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(this.colorHex),
                metalness: 0.45,
                roughness: 0.25
            });
            const darkMat = new THREE.MeshStandardMaterial({
                color: 0x0f172a,
                metalness: 0.3,
                roughness: 0.6
            });
            const glassMat = new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                metalness: 0.85,
                roughness: 0.1
            });

            // Main Chassis
            const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.68, 4.4), paintMat);
            chassis.position.y = 0.62;
            chassis.castShadow = true;
            chassis.receiveShadow = true;
            root.add(chassis);

            // Sculpted Cabin
            const cabinWidth = this.carSpec.bodyStyle === 'prototype' ? 1.5 : 1.75;
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth, 0.58, 2.1), glassMat);
            cabin.position.set(0, 1.18, -0.15);
            cabin.castShadow = true;
            root.add(cabin);

            // Roof panel
            const roof = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth * 0.96, 0.08, 1.4), paintMat);
            roof.position.set(0, 1.49, -0.2);
            root.add(roof);

            // Rear Spoiler Wing
            const wing = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.1, 0.48), darkMat);
            wing.position.set(0, 1.24, -1.95);
            wing.castShadow = true;
            root.add(wing);

            [-0.75, 0.75].forEach(x => {
                const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.25), darkMat);
                strut.position.set(x, 1.05, -1.95);
                root.add(strut);
            });

            // Headlights & Taillights
            const headMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
            const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a55 });
            [-0.7, 0.7].forEach(x => {
                const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
                hl.position.set(x, 0.68, 2.21);
                root.add(hl);

                const tl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.08), tailMat);
                tl.position.set(x, 0.72, -2.21);
                root.add(tl);
            });

            // Sculpted aero details, vents, side skirts and front splitter
            const trimMat = new THREE.MeshStandardMaterial({ color: 0x080d18, metalness: 0.72, roughness: 0.28 });
            const carbonMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.58, roughness: 0.34 });
            const accentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.colorHex), metalness: 0.55, roughness: 0.22, emissive: new THREE.Color(this.colorHex), emissiveIntensity: 0.16 });
            const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.12, 0.62), carbonMat); splitter.position.set(0, 0.36, 2.12); root.add(splitter);
            const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.16, 0.55), carbonMat); diffuser.position.set(0, 0.34, -2.12); root.add(diffuser);
            [-1, 1].forEach(side => { const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 2.55), trimMat); skirt.position.set(side * 1.03, 0.37, -0.05); root.add(skirt); const sill = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 2.35), accentMat); sill.position.set(side * 1.115, 0.48, -0.05); root.add(sill); });
            [-0.48, 0.48].forEach(x => { const vent = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.72), trimMat); vent.position.set(x, 0.98, 1.18); root.add(vent); const rearVent = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.48), carbonMat); rearVent.position.set(x, 0.98, -1.52); root.add(rearVent); });

            // 4 Wheels
            this.wheels = [];
            const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 14);
            wheelGeo.rotateZ(Math.PI / 2);
            const wheelPositions = [
                [-1.12, 0.42, 1.35],
                [1.12, 0.42, 1.35],
                [-1.12, 0.42, -1.35],
                [1.12, 0.42, -1.35]
            ];
            wheelPositions.forEach(p => {
                const w = new THREE.Mesh(wheelGeo, darkMat); w.position.set(p[0], p[1], p[2]); w.castShadow = true; root.add(w);
                const rimGeo = new THREE.CylinderGeometry(0.245, 0.245, 0.355, 16); rimGeo.rotateZ(Math.PI / 2);
                const rim = new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.92, roughness: 0.2 })); rim.position.copy(w.position); root.add(rim);
                const hubGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.37, 12); hubGeo.rotateZ(Math.PI / 2);
                const hub = new THREE.Mesh(hubGeo, accentMat); hub.position.copy(w.position); root.add(hub);
                this.wheels.push(w);
            });

            // Twin Exhaust Flame Cones (visible when boosting)
            this.flameMeshes = [];
            const flameGeo = new THREE.ConeGeometry(0.18, 1.1, 8);
            flameGeo.rotateX(-Math.PI / 2);
            const flameMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
            [-0.45, 0.45].forEach(x => {
                const flame = new THREE.Mesh(flameGeo, flameMat);
                flame.position.set(x, 0.48, -2.75);
                flame.visible = false;
                root.add(flame);
                this.flameMeshes.push(flame);
            });

            return root;
        }

        placeOnGrid(gridIndex) {
            // Staggered 2x2 starting grid behind start line
            const row = Math.floor(gridIndex / 2);
            const col = gridIndex % 2 === 0 ? -1 : 1;
            const t = (1 - (0.015 + row * 0.018) + 1) % 1;
            const pt = this.track.curve.getPointAt(t);
            const tangent = this.track.curve.getTangentAt(t).normalize();
            const right = new THREE.Vector3(-tangent.z, 0, tangent.x);

            this.position.copy(pt).addScaledVector(right, col * 3.8);
            this.heading = Math.atan2(tangent.x, tangent.z);
            this.velocity.set(0, 0, 0);
            this.speed = 0;
            this.lap = 1;
            this.nextCheckpoint = 1;
            this.trackT = t;
            this.totalProgress = - (0.015 + row * 0.018);
            this.finished = false;
            this.boostTimer = 0;
            this.aiTargetT = (t + 0.035) % 1;
            this.syncMeshTransform(0);
        }

        resetToTrack() {
            const info = this.track.getClosestTrackInfo(this.position);
            const tangent = this.track.curve.getTangentAt(info.t).normalize();
            this.position.copy(info.point);
            this.position.y = 0;
            this.heading = Math.atan2(tangent.x, tangent.z);
            this.velocity.set(0, 0, 0);
            this.speed = 0;
            this.boostTimer = 0;
        }

        update(dt, input, allVehicles, raceActive, raceClock, sound) {
            if (this.isRemote) {
                // Smoothly interpolate remote multiplayer car
                if (this.remoteTargetPos) {
                    this.position.lerp(this.remoteTargetPos, Math.min(1, dt * 14));
                    // Shortest angular interpolation
                    let diff = this.remoteTargetHeading - this.heading;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    this.heading += diff * Math.min(1, dt * 14);
                }
                this.syncMeshTransform(dt);
                return;
            }

            let throttle = 0;
            let steer = 0;
            let drift = false;

            if (raceActive && !this.finished) {
                if (this.isPlayer) {
                    throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
                    steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
                    drift = input.drift;
                } else if (this.isAI) {
                    const aiCtrl = this.computeAIControls();
                    throttle = aiCtrl.throttle;
                    steer = aiCtrl.steer;
                    drift = aiCtrl.drift;
                }
            } else if (this.finished) {
                // Gentle AI cruise after crossing finish line
                const aiCtrl = this.computeAIControls();
                throttle = aiCtrl.throttle * 0.55;
                steer = aiCtrl.steer;
            }

            // Boost timer countdown
            if (this.boostTimer > 0) {
                this.boostTimer = Math.max(0, this.boostTimer - dt);
            }

            if (this.isPlayer && drift && Math.abs(this.speed) > 22 && Math.abs(steer) > 0.12) {
                this.nitroCharge = Math.min(100, this.nitroCharge + dt * (8 + Math.abs(this.speed) * 0.12));
                this.driftScore += Math.round(dt * Math.abs(this.speed) * 3.2);
            }
            if (this.isPlayer && input.boost && this.nitroCharge >= 25 && this.boostTimer <= 0.12) {
                this.nitroCharge = Math.max(0, this.nitroCharge - 25); this.boostTimer = 1.45; sound.playBoost();
            }
            const boostMultiplier = this.boostTimer > 0 ? 1.34 : 1.0;
            const effectiveMaxSpeed = this.carSpec.maxSpeed * boostMultiplier * (this.isAI ? this.aiSkill : 1.0);

            // Forward direction vector
            const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));

            // Acceleration / Braking
            if (throttle > 0) {
                this.speed += this.carSpec.accelForce * boostMultiplier * dt;
            } else if (throttle < 0) {
                this.speed -= this.carSpec.accelForce * 1.35 * dt;
            } else {
                // Natural rolling resistance
                this.speed *= Math.pow(0.45, dt);
            }

            if (this.boostTimer > 0) {
                this.speed = Math.max(this.speed, effectiveMaxSpeed * 0.92);
            }

            this.speed = THREE.MathUtils.clamp(this.speed, -26, effectiveMaxSpeed);

            // Steering & Arcade Drift Dynamics
            this.isDrifting = drift && Math.abs(this.speed) > 24 && Math.abs(steer) > 0.1;
            const turnMultiplier = this.isDrifting ? 1.38 : 1.0;
            const speedTurnFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 22, 0, 1);
            const reverseSign = this.speed >= -0.5 ? 1 : -1;

            this.heading += steer * this.carSpec.turnRate * turnMultiplier * speedTurnFactor * reverseSign * dt;

            // Lateral grip vs drift slide
            const right = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
            const longitudinal = this.velocity.dot(forward);
            const lateral = this.velocity.dot(right);
            const targetLongitudinal = this.speed;
            const lateralRetention = this.isDrifting ? 0.965 : THREE.MathUtils.clamp(1 - (7.5 * this.carSpec.grip * dt), 0.08, 0.92);
            const lateralAcceleration = steer * Math.abs(this.speed) * (this.isDrifting ? 0.42 : 0.13);
            const nextLateral = lateral * lateralRetention + lateralAcceleration * dt;
            const nextLongitudinal = THREE.MathUtils.lerp(longitudinal, targetLongitudinal, Math.min(1, (this.isDrifting ? 3.2 : 10.5) * dt));
            this.velocity.copy(forward).multiplyScalar(nextLongitudinal).addScaledVector(right, nextLateral);

            // Apply velocity with inertia, grip and a controllable drift angle
            this.position.addScaledVector(this.velocity, dt);
            this.driftAngle = THREE.MathUtils.lerp(this.driftAngle || 0, Math.atan2(nextLateral, Math.max(1, Math.abs(nextLongitudinal))), Math.min(1, dt * 5));

            // Visual body roll during cornering
            const targetRoll = -steer * (this.isDrifting ? 0.18 : 0.075) * speedTurnFactor;
            this.visualRoll = THREE.MathUtils.lerp(this.visualRoll, targetRoll, dt * 10);

            // Track Boundary Collision & Boost Pad Detection
            this.handleTrackCollisions(sound);

            // Car-to-Car Arcade Elastic Collision
            this.handleCarCollisions(allVehicles, sound);

            // Lap & Checkpoint Progression
            if (raceActive && !this.finished) {
                this.updateLapProgress(raceClock);
            }

            // Tire Skid Marks & Boost Flames
            this.updateEffects(dt);
            this.syncMeshTransform(dt);
        }

        computeAIControls() {
            const info = this.track.getClosestTrackInfo(this.position);
            const lookAheadT = (info.t + 0.032) % 1;
            const targetPt = this.track.curve.getPointAt(lookAheadT);
            const tangent = this.track.curve.getTangentAt(lookAheadT).normalize();
            const right = new THREE.Vector3(-tangent.z, 0, tangent.x);
            targetPt.addScaledVector(right, this.aiLaneOffset);

            const toTarget = targetPt.clone().sub(this.position);
            const desiredHeading = Math.atan2(toTarget.x, toTarget.z);

            let diff = desiredHeading - this.heading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            const steer = THREE.MathUtils.clamp(diff * 2.4, -1, 1);
            const sharpTurn = Math.abs(diff) > 0.42;
            return {
                throttle: sharpTurn ? 0.72 : 1.0,
                steer,
                drift: sharpTurn && this.speed > 45
            };
        }

        handleTrackCollisions(sound) {
            const info = this.track.getClosestTrackInfo(this.position);
            const maxAllowedDist = (this.track.roadWidth / 2) + 1.1;

            if (info.distance > maxAllowedDist) {
                // Push car smoothly back inside guardrails
                const pushDir = info.point.clone().sub(this.position).setY(0).normalize();
                const penetration = info.distance - maxAllowedDist;
                this.position.addScaledVector(pushDir, penetration);

                // Dampen speed slightly on wall scrape
                this.speed *= 0.92;
                this.velocity.multiplyScalar(0.9);
                if (this.isPlayer && penetration > 0.35 && Math.abs(this.speed) > 20) {
                    sound.playBump();
                }
            }

            // Boost pad trigger
            for (const pad of this.track.boostPads) {
                if (this.position.distanceToSquared(pad.position) < pad.radius * pad.radius) {
                    if (this.boostTimer < 0.8 && this.isPlayer) { sound.playBoost(); this.nitroCharge = Math.min(100, this.nitroCharge + 12); }
                    this.boostTimer = 1.65;
                }
            }
        }

        handleCarCollisions(allVehicles, sound) {
            const minSep = 2.8;
            for (const other of allVehicles) {
                if (other === this) continue;
                const diff = this.position.clone().sub(other.position).setY(0);
                const dist = diff.length();
                if (dist > 0.001 && dist < minSep) {
                    const overlap = (minSep - dist) * 0.5;
                    const normal = diff.normalize();
                    this.position.addScaledVector(normal, overlap);
                    if (!other.isRemote) {
                        other.position.addScaledVector(normal, -overlap);
                    }
                    this.speed *= 0.95;
                    if (this.isPlayer) sound.playBump();
                }
            }
        }

        updateLapProgress(raceClock) {
            const info = this.track.getClosestTrackInfo(this.position);
            this.trackT = info.t;

            // Check sequential checkpoint gate
            const cp = this.track.checkpoints[this.nextCheckpoint];
            if (cp && this.position.distanceTo(cp.position) < cp.radius * 1.45) {
                this.nextCheckpoint = (this.nextCheckpoint + 1) % this.track.checkpoints.length;
                if (this.nextCheckpoint === 1) {
                    // Completed full circuit lap!
                    const lapDuration = raceClock - this.currentLapStart;
                    if (lapDuration > 4 && lapDuration < this.bestLapTime) {
                        this.bestLapTime = lapDuration;
                    }
                    this.currentLapStart = raceClock;
                    this.lap++;

                    if (this.lap > 3) {
                        this.lap = 3;
                        this.finished = true;
                        this.finishTime = raceClock;
                    }
                }
            }

            // Continuous progress score for live race standings
            const checkpointFraction = ((this.nextCheckpoint - 1 + this.track.checkpoints.length) % this.track.checkpoints.length) / this.track.checkpoints.length;
            this.totalProgress = (this.lap - 1) + Math.max(checkpointFraction, this.trackT * 0.95);
        }

        updateEffects(dt) {
            // Boost exhaust cones
            const showBoost = this.boostTimer > 0;
            for (const f of this.flameMeshes) {
                f.visible = showBoost;
                if (showBoost) {
                    f.scale.z = 0.8 + Math.random() * 0.65;
                }
            }

            // Tire skid marks when drifting
            this.skidTimer += dt;
            if (this.isDrifting && this.skidTimer > 0.04) {
                this.skidTimer = 0;
                const right = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
                const back = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));

                [-0.95, 0.95].forEach(side => {
                    const markPos = this.position.clone()
                        .addScaledVector(right, side)
                        .addScaledVector(back, 1.35);
                    const mark = new THREE.Mesh(
                        new THREE.PlaneGeometry(0.32, 0.75),
                        new THREE.MeshBasicMaterial({ color: 0x090d16, transparent: true, opacity: 0.65 })
                    );
                    mark.position.set(markPos.x, 0.035, markPos.z);
                    mark.rotation.x = -Math.PI / 2;
                    mark.rotation.z = -this.heading;
                    this.scene.add(mark);
                    this.skidMarks.push(mark);

                    if (this.skidMarks.length > 90) {
                        const old = this.skidMarks.shift();
                        this.scene.remove(old);
                        old.geometry.dispose();
                    }
                });
            }
        }

        syncMeshTransform(dt) {
            this.mesh.position.copy(this.position);
            this.mesh.rotation.y = this.heading;
            this.mesh.rotation.z = this.visualRoll;

            // Spin wheels
            const wheelSpin = this.speed * dt * 2.2;
            for (const w of this.wheels) {
                w.rotation.x += wheelSpin;
            }
        }

        dispose() {
            this.scene.remove(this.mesh);
            for (const m of this.skidMarks) {
                this.scene.remove(m);
                m.geometry.dispose();
            }
            this.skidMarks = [];
        }
    }

    // -------------------------------------------------------------------------
    // 5. REAL-TIME MULTIPLAYER ROOM ENGINE (BroadcastChannel + LocalStorage)
    // -------------------------------------------------------------------------

export { Vehicle };
