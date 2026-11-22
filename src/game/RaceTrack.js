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
            // Grandstands near start/finish straight
            const standMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.4 });
            [-32, -75].forEach(zPos => {
                const stand = new THREE.Group();
                const base = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 34), standMat);
                base.position.y = 4;
                base.castShadow = true;
                base.receiveShadow = true;
                stand.add(base);

                const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.8, 36), roofMat);
                roof.position.set(-1.5, 9.5, 0);
                roof.castShadow = true;
                stand.add(roof);

                stand.position.set(24, 0, zPos);
                this.group.add(stand);
            });

            // Stylized Low-Poly Pine Trees scattered safely outside track corridor
            const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 3, 6);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
            const leavesGeo = new THREE.ConeGeometry(3.2, 8.5, 7);
            const leavesMat = new THREE.MeshStandardMaterial({ color: this.config.treeColor, roughness: 0.8 });

            let placed = 0;
            let attempts = 0;
            while (placed < 135 && attempts < 1200) {
                attempts++;
                const rx = (Math.random() - 0.5) * 780;
                const rz = (Math.random() - 0.5) * 780;
                const candidate = new THREE.Vector3(rx, 0, rz);

                // Ensure minimum distance from any track point
                let tooClose = false;
                for (let i = 0; i < this.curvePoints.length; i += 4) {
                    if (candidate.distanceToSquared(this.curvePoints[i]) < 26 * 26) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;

                const tree = new THREE.Group();
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.y = 1.5;
                trunk.castShadow = true;
                tree.add(trunk);

                const crown = new THREE.Mesh(leavesGeo, leavesMat);
                crown.position.y = 6.5;
                crown.castShadow = true;
                tree.add(crown);

                const scale = 0.8 + Math.random() * 0.75;
                tree.scale.set(scale, scale, scale);
                tree.position.copy(candidate);
                this.group.add(tree);
                placed++;
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
