const THREE = window.THREE;
import { getTrackConfig } from "./TrackCatalog.js";

class RaceTrack {
        constructor(scene, trackId = "neon-coast") {
            this.scene = scene;
            this.group = new THREE.Group();
            this.config = getTrackConfig(trackId);
            this.trackId = this.config.id;
            this.roadWidth = this.config.roadWidth;
            this.samples = 420;
            this.checkpoints = [];
            this.boostPads = [];
            this.buildCircuit();
            this.scene.add(this.group);
        }

        buildCircuit() {
            const controlPoints = this.config.points.map(point => new THREE.Vector3(point[0], point[1], point[2]));

            this.curve = new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom', 0.5);
            this.curvePoints = this.curve.getSpacedPoints(this.samples);

            // Ground terrain
            const groundGeo = new THREE.PlaneGeometry(1400, 1400);
            const groundMat = new THREE.MeshStandardMaterial({
                color: this.config.groundColor,
                roughness: 0.92,
                metalness: 0.05
            });
            const ground = new THREE.Mesh(groundGeo, groundMat);
            ground.rotation.x = -Math.PI / 2;
            ground.position.y = -0.15;
            ground.receiveShadow = true;
            this.group.add(ground);

            // Build Asphalt Ribbon, Curbs, and Outer Guardrails
            this.buildRoadMesh();
            this.buildStartFinishGantry();
            this.buildCheckpoints();
            this.buildBoostPads();
            this.buildScenery();
        }

        buildRoadMesh() {
            const roadPositions = [];
            const roadUVs = [];
            const roadIndices = [];

            const curbPositions = [];
            const curbColors = [];
            const curbIndices = [];

            const halfW = this.roadWidth / 2;
            const curbW = halfW + 1.4;

            for (let i = 0; i <= this.samples; i++) {
                const t = (i % this.samples) / this.samples;
                const pt = this.curve.getPointAt(t);
                const tangent = this.curve.getTangentAt(t).normalize();
                const right = new THREE.Vector3(-tangent.z, 0, tangent.x);

                // Road vertices
                const leftPt = pt.clone().addScaledVector(right, -halfW);
                const rightPt = pt.clone().addScaledVector(right, halfW);
                roadPositions.push(leftPt.x, 0.02, leftPt.z, rightPt.x, 0.02, rightPt.z);
                roadUVs.push(0, i * 0.25, 1, i * 0.25);

                // Curb vertices
                const cLeft = pt.clone().addScaledVector(right, -curbW);
                const cRight = pt.clone().addScaledVector(right, curbW);
                curbPositions.push(cLeft.x, 0.01, cLeft.z, cRight.x, 0.01, cRight.z);

                const isRed = Math.floor(i / 2) % 2 === 0;
                const c = isRed ? new THREE.Color(0xef4444) : new THREE.Color(0xf8fafc);
                curbColors.push(c.r, c.g, c.b, c.r, c.g, c.b);

                if (i < this.samples) {
                    const base = i * 2;
                    roadIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
                    curbIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
                }
            }

            const roadGeo = new THREE.BufferGeometry();
            roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
            roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUVs, 2));
            roadGeo.setIndex(roadIndices);
            roadGeo.computeVertexNormals();

            const roadMat = new THREE.MeshStandardMaterial({
                color: 0x1e2530,
                roughness: 0.78,
                metalness: 0.1
            });
            const roadMesh = new THREE.Mesh(roadGeo, roadMat);
            roadMesh.receiveShadow = true;
            this.group.add(roadMesh);

            // Racing Curbs
            const curbGeo = new THREE.BufferGeometry();
            curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPositions, 3));
            curbGeo.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
            curbGeo.setIndex(curbIndices);
            curbGeo.computeVertexNormals();

            const curbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
            const curbMesh = new THREE.Mesh(curbGeo, curbMat);
            curbMesh.receiveShadow = true;
            this.group.add(curbMesh);

            // Center dashed racing line & barrier posts
            const dashGeo = new THREE.BoxGeometry(0.45, 0.03, 2.4);
            const dashMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
            const postGeo = new THREE.BoxGeometry(0.7, 1.35, 3.2);
            const postMatA = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 });
            const postMatB = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });

            for (let i = 0; i < this.samples; i += 3) {
                const t = i / this.samples;
                const pt = this.curve.getPointAt(t);
                const tangent = this.curve.getTangentAt(t).normalize();
                const right = new THREE.Vector3(-tangent.z, 0, tangent.x);
                const angle = Math.atan2(tangent.x, tangent.z);

                const dash = new THREE.Mesh(dashGeo, dashMat);
                dash.position.set(pt.x, 0.03, pt.z);
                dash.rotation.y = angle;
                this.group.add(dash);

                // Left and right barrier blocks
                [-1, 1].forEach(side => {
                    const bPt = pt.clone().addScaledVector(right, side * (halfW + 2.3));
                    const barrier = new THREE.Mesh(postGeo, (i / 3) % 2 === 0 ? postMatA : postMatB);
                    barrier.position.set(bPt.x, 0.65, bPt.z);
                    barrier.rotation.y = angle;
                    barrier.castShadow = true;
                    barrier.receiveShadow = true;
                    this.group.add(barrier);
                });
            }
        }

        buildStartFinishGantry() {
            const pt = this.curve.getPointAt(0);
            const tangent = this.curve.getTangentAt(0).normalize();
            const angle = Math.atan2(tangent.x, tangent.z);

            const gantry = new THREE.Group();
            gantry.position.copy(pt);
            gantry.rotation.y = angle;

            // Checkered floor strip
            const lineGeo = new THREE.PlaneGeometry(this.roadWidth, 4);
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            for (let x = 0; x < 16; x++) {
                for (let y = 0; y < 4; y++) {
                    ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#0f172a';
                    ctx.fillRect(x * 8, y * 8, 8, 8);
                }
            }
            const tex = new THREE.CanvasTexture(canvas);
            const lineMesh = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ map: tex }));
            lineMesh.rotation.x = -Math.PI / 2;
            lineMesh.position.y = 0.04;
            gantry.add(lineMesh);

            // Overhead Arch Pillars & Banner
            const pillarGeo = new THREE.BoxGeometry(1.4, 9.5, 1.4);
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.3 });
            const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
            leftPillar.position.set(-this.roadWidth / 2 - 1.5, 4.75, 0);
            leftPillar.castShadow = true;
            gantry.add(leftPillar);

            const rightPillar = leftPillar.clone();
            rightPillar.position.x = this.roadWidth / 2 + 1.5;
            gantry.add(rightPillar);

            const bannerGeo = new THREE.BoxGeometry(this.roadWidth + 4.5, 2.2, 1.6);
            const bannerMat = new THREE.MeshStandardMaterial({
                color: 0x0284c7,
                emissive: 0x0369a1,
                emissiveIntensity: 0.45
            });
            const banner = new THREE.Mesh(bannerGeo, bannerMat);
            banner.position.set(0, 9.2, 0);
            banner.castShadow = true;
            gantry.add(banner);

            this.group.add(gantry);
        }

        buildCheckpoints() {
            // 8 sequential checkpoint gates around the circuit to prevent shortcutting
            const count = 8;
            for (let i = 0; i < count; i++) {
                const t = i / count;
                const pt = this.curve.getPointAt(t);
                const tangent = this.curve.getTangentAt(t).normalize();
                this.checkpoints.push({
                    index: i,
                    t,
                    position: pt,
                    tangent,
                    radius: this.roadWidth * 0.85
                });
            }
        }

        buildBoostPads() {
            // 5 glowing neon turbo chevrons placed strategically on straights & exits
            const boostTs = [0.11, 0.29, 0.51, 0.72, 0.89];
            const padGeo = new THREE.PlaneGeometry(5.5, 9);
            const padMat = new THREE.MeshBasicMaterial({
                color: 0x22d3ee,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.85
            });

            boostTs.forEach(t => {
                const pt = this.curve.getPointAt(t);
                const tangent = this.curve.getTangentAt(t).normalize();
                const angle = Math.atan2(tangent.x, tangent.z);

                const mesh = new THREE.Mesh(padGeo, padMat);
                mesh.position.set(pt.x, 0.06, pt.z);
                mesh.rotation.x = -Math.PI / 2;
                mesh.rotation.z = -angle;
                this.group.add(mesh);

                // Side neon beacons
                const beaconGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
                const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
                const b1 = new THREE.Mesh(beaconGeo, beaconMat);
                b1.position.set(pt.x + 3.2, 0.6, pt.z);
                this.group.add(b1);

                this.boostPads.push({ position: pt, radius: 4.5, mesh });
            });
        }

        buildScenery() {
            // Shared trackside materials keep the detailed environment inexpensive.
            const asphaltShoulderMat = new THREE.MeshStandardMaterial({ color: 0x343b48, roughness: 0.94 });
            const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa9bb, metalness: 0.78, roughness: 0.28 });
            const darkMat = new THREE.MeshStandardMaterial({ color: 0x101827, metalness: 0.55, roughness: 0.38 });
            const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x42e8ff });
            const warmGlow = new THREE.MeshBasicMaterial({ color: 0xffc47a });
            const boardMat = new THREE.MeshStandardMaterial({ color: 0x10223d, emissive: 0x06365a, emissiveIntensity: 0.65, metalness: 0.45 });
            const lampGeo = new THREE.CylinderGeometry(0.09, 0.14, 7.5, 8);
            const lampHeadGeo = new THREE.BoxGeometry(1.2, 0.18, 0.42);
            const railGeo = new THREE.BoxGeometry(0.22, 0.7, 8);
            const postGeo = new THREE.BoxGeometry(0.22, 1.1, 0.22);

            // More convincing safety barriers, reflective posts and illuminated circuit furniture.
            for (let i = 5; i < this.samples; i += 14) {
                const t = i / this.samples;
                const pt = this.curve.getPointAt(t);
                const tangent = this.curve.getTangentAt(t).normalize();
                const right = new THREE.Vector3(-tangent.z, 0, tangent.x);
                const angle = Math.atan2(tangent.x, tangent.z);
                [-1, 1].forEach((side, sideIndex) => {
                    const edge = pt.clone().addScaledVector(right, side * (this.roadWidth / 2 + 4.6));
                    const rail = new THREE.Mesh(railGeo, railMat);
                    rail.position.set(edge.x, 1.05, edge.z);
                    rail.rotation.y = angle;
                    rail.castShadow = true;
                    this.group.add(rail);
                    const post = new THREE.Mesh(postGeo, darkMat);
                    post.position.set(edge.x, 0.58, edge.z);
                    post.rotation.y = angle;
                    this.group.add(post);
                    if (i % 28 === 5) {
                        const polePos = pt.clone().addScaledVector(right, side * (this.roadWidth / 2 + 9));
                        const pole = new THREE.Mesh(lampGeo, darkMat);
                        pole.position.set(polePos.x, 3.7, polePos.z);
                        this.group.add(pole);
                        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 0.12), darkMat);
                        arm.position.set(polePos.x - side * 0.9, 7.25, polePos.z);
                        arm.rotation.y = angle;
                        this.group.add(arm);
                        const head = new THREE.Mesh(lampHeadGeo, warmGlow);
                        head.position.set(polePos.x - side * 1.7, 7.15, polePos.z);
                        this.group.add(head);
                        const glow = new THREE.PointLight(0xffd39a, 0.55, 24, 2);
                        glow.position.set(head.position.x, 6.8, head.position.z);
                        this.group.add(glow);
                    }
                    if (i % 56 === 5) {
                        const signPos = pt.clone().addScaledVector(right, side * (this.roadWidth / 2 + 7));
                        const sign = new THREE.Group();
                        const panel = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.2, 0.28), boardMat);
                        panel.position.y = 4.2;
                        sign.add(panel);
                        const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.12, 0.34), cyanGlow);
                        stripe.position.set(0, 3.55, 0);
                        sign.add(stripe);
                        sign.position.copy(signPos);
                        sign.rotation.y = angle;
                        this.group.add(sign);
                    }
                });
            }

            // Grandstands with roof ribs and coloured fascia around the start zone.
            const standMat = new THREE.MeshStandardMaterial({ color: 0x26364d, roughness: 0.72 });
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x10243d, metalness: 0.45, roughness: 0.34 });
            const seatMat = new THREE.MeshStandardMaterial({ color: 0x53677f, roughness: 0.82 });
            [-38, -82].forEach((zPos, idx) => {
                const stand = new THREE.Group();
                const base = new THREE.Mesh(new THREE.BoxGeometry(15, 7, 34), standMat);
                base.position.y = 3.5;
                base.castShadow = true;
                stand.add(base);
                for (let row = 0; row < 5; row++) {
                    const seats = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.3, 3.8), seatMat);
                    seats.position.set(-1, 5 + row * 0.62, -12 + row * 4.2);
                    stand.add(seats);
                }
                const roof = new THREE.Mesh(new THREE.BoxGeometry(18, 0.7, 38), roofMat);
                roof.position.set(-1.5, 9.1, 0);
                roof.castShadow = true;
                stand.add(roof);
                const fascia = new THREE.Mesh(new THREE.BoxGeometry(18.2, 0.28, 0.35), idx ? warmGlow : cyanGlow);
                fascia.position.set(-1.5, 8.1, 17.2);
                stand.add(fascia);
                stand.position.set(25, 0, zPos);
                this.group.add(stand);
            });

            // Distinct trackside trees, instanced through shared geometry and materials.
            const trunkGeo = new THREE.CylinderGeometry(0.38, 0.58, 3.2, 6);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x594232 });
            const leavesGeo = new THREE.ConeGeometry(3.1, 8.2, 7);
            const leavesMat = new THREE.MeshStandardMaterial({ color: this.config.treeColor, roughness: 0.84 });
            let placed = 0;
            let attempts = 0;
            while (placed < 115 && attempts < 1100) {
                attempts++;
                const candidate = new THREE.Vector3((Math.random() - 0.5) * 780, 0, (Math.random() - 0.5) * 780);
                let tooClose = false;
                for (let i = 0; i < this.curvePoints.length; i += 4) {
                    if (candidate.distanceToSquared(this.curvePoints[i]) < 32 * 32) { tooClose = true; break; }
                }
                if (tooClose) continue;
                const tree = new THREE.Group();
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.y = 1.6;
                trunk.castShadow = true;
                tree.add(trunk);
                const crown = new THREE.Mesh(leavesGeo, leavesMat);
                crown.position.y = 6.2;
                crown.castShadow = true;
                tree.add(crown);
                const scale = 0.78 + Math.random() * 0.8;
                tree.scale.set(scale, scale, scale);
                tree.rotation.y = Math.random() * Math.PI;
                tree.position.copy(candidate);
                this.group.add(tree);
                placed++;
            }

            // Distant skyline silhouettes make the coastal circuit feel like a real venue.
            if (this.trackId === "neon-coast") {
                const skylineMat = new THREE.MeshStandardMaterial({ color: 0x14263e, roughness: 0.9, metalness: 0.12 });
                const skylineGlow = new THREE.MeshBasicMaterial({ color: 0x2b91bd });
                for (let i = 0; i < 34; i++) {
                const angle = (i / 34) * Math.PI * 2;
                const radius = 360 + (i % 4) * 22;
                const width = 10 + (i % 5) * 3;
                const height = 18 + ((i * 17) % 42);
                const building = new THREE.Group();
                const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, 9 + (i % 3) * 3), skylineMat);
                tower.position.y = height / 2 - 1;
                building.add(tower);
                for (let row = 0; row < 4; row++) {
                    const windowStrip = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.12, 0.08), skylineGlow);
                    windowStrip.position.set(0, 4 + row * Math.max(3, height / 5), 4.7 + (i % 3));
                    building.add(windowStrip);
                }
                building.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
                building.rotation.y = -angle;
                    this.group.add(building);
                }
            } else {
                // Give each destination its own horizon instead of reusing the coastal skyline.
                const alpine = this.trackId === "alpine-pass";
                const landformMat = new THREE.MeshStandardMaterial({
                    color: alpine ? 0x526a78 : 0xa87945,
                    roughness: 0.96,
                    flatShading: true
                });
                const ridgeMat = new THREE.MeshStandardMaterial({
                    color: alpine ? 0x9db8c5 : 0xd7a86d,
                    roughness: 1,
                    flatShading: true
                });
                const landGeo = alpine ? new THREE.ConeGeometry(1, 1, 7) : new THREE.SphereGeometry(1, 9, 6);
                for (let i = 0; i < 42; i++) {
                    const angle = (i / 42) * Math.PI * 2;
                    const radius = 350 + (i % 5) * 28;
                    const height = alpine ? 65 + (i % 7) * 12 : 18 + (i % 6) * 5;
                    const landform = new THREE.Mesh(landGeo, landformMat);
                    landform.position.set(Math.cos(angle) * radius, alpine ? height * 0.42 : height * 0.08, Math.sin(angle) * radius);
                    landform.scale.set(alpine ? 58 + (i % 4) * 13 : 65 + (i % 4) * 18, height, alpine ? 58 + (i % 3) * 12 : 48);
                    landform.rotation.y = angle * 0.7;
                    landform.castShadow = true;
                    this.group.add(landform);
                    if (alpine && i % 2 === 0) {
                        const snowcap = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 7), ridgeMat);
                        snowcap.position.copy(landform.position);
                        snowcap.position.y += height * 0.42;
                        snowcap.scale.set(landform.scale.x * 0.34, height * 0.3, landform.scale.z * 0.34);
                        this.group.add(snowcap);
                    }
                }
            }
        }

        // Find closest point & spline t parameter for a world position
        getClosestTrackInfo(pos) {
            let minDistSq = Infinity;
            let bestIdx = 0;
            for (let i = 0; i < this.samples; i++) {
                const dSq = pos.distanceToSquared(this.curvePoints[i]);
                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    bestIdx = i;
                }
            }
            return {
                t: bestIdx / this.samples,
                point: this.curvePoints[bestIdx],
                distance: Math.sqrt(minDistSq)
            };
        }

        dispose() {
            this.scene.remove(this.group);
            const geometries = new Set();
            const materials = new Set();
            this.group.traverse(object => {
                if (object.geometry) geometries.add(object.geometry);
                if (Array.isArray(object.material)) object.material.forEach(material => materials.add(material));
                else if (object.material) materials.add(object.material);
            });
            geometries.forEach(geometry => geometry.dispose());
            materials.forEach(material => {
                if (material.map) material.map.dispose();
                material.dispose();
            });
        }
    }

    // -------------------------------------------------------------------------
    // 4. VEHICLE ENTITY (3D MESH, ARCADE PHYSICS, DRIFT TRAILS & AI)
    // -------------------------------------------------------------------------

export { RaceTrack };
