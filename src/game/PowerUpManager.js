const THREE = window.THREE;

const POWERUPS = [
  { id: "missile", name: "HOMING PULSE", color: 0xff4d6d, symbol: "M", hint: "F to fire at the rival ahead" },
  { id: "shield", name: "PHASE SHIELD", color: 0x42e8ff, symbol: "S", hint: "F to block one incoming hit" },
  { id: "shockwave", name: "SHOCKWAVE", color: 0xb58cff, symbol: "W", hint: "F to disrupt nearby rivals" },
  { id: "nitro", name: "TURBO CELL", color: 0xffc857, symbol: "N", hint: "F for an instant speed burst" }
];

class PowerUpManager {
  constructor(scene, track, onMessage = () => {}) {
    this.scene = scene;
    this.track = track;
    this.onMessage = onMessage;
    this.pickups = [];
    this.effects = [];
    this.spawnPickups();
  }

  spawnPickups() {
    const count = 9;
    for (let i = 0; i < count; i++) {
      const t = (0.045 + i / count) % 1;
      const point = this.track.curve.getPointAt(t);
      const tangent = this.track.curve.getTangentAt(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const position = point.addScaledVector(side, i % 2 ? 3.2 : -3.2);
      const config = POWERUPS[i % POWERUPS.length];
      const group = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.78, 1),
        new THREE.MeshStandardMaterial({ color: config.color, emissive: config.color, emissiveIntensity: 1.15, metalness: 0.35, roughness: 0.2 })
      );
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.12, 0.055, 8, 28),
        new THREE.MeshBasicMaterial({ color: config.color, transparent: true, opacity: 0.8 })
      );
      halo.rotation.x = Math.PI / 2;
      group.add(core, halo);
      group.position.copy(position);
      group.position.y = 1.35;
      this.scene.add(group);
      this.pickups.push({ group, config, baseY: 1.35, active: true, respawn: 0 });
    }
  }

  update(dt, vehicles, elapsed) {
    for (const pickup of this.pickups) {
      if (!pickup.active) {
        pickup.respawn -= dt;
        if (pickup.respawn <= 0) {
          pickup.active = true;
          pickup.group.visible = true;
        }
        continue;
      }
      pickup.group.rotation.y += dt * 1.5;
      pickup.group.position.y = pickup.baseY + Math.sin(elapsed * 2.8 + pickup.group.position.x) * 0.18;
      for (const vehicle of vehicles) {
        if (vehicle.finished || vehicle.isRemote || vehicle.weapon) continue;
        if (vehicle.position.distanceToSquared(pickup.group.position) < 7.5) {
          vehicle.weapon = pickup.config.id;
          pickup.active = false;
          pickup.respawn = 8;
          pickup.group.visible = false;
          if (vehicle.isPlayer) this.onMessage(pickup.config.name + " collected. " + pickup.config.hint);
          break;
        }
      }
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= dt;
      effect.mesh.scale.multiplyScalar(1 + dt * 2.8);
      effect.mesh.material.opacity = Math.max(0, effect.life / effect.duration) * 0.72;
      if (effect.life <= 0) {
        this.scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        effect.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
    for (const vehicle of vehicles) {
      if (vehicle.shieldTimer > 0) vehicle.shieldTimer = Math.max(0, vehicle.shieldTimer - dt);
      if (vehicle.stunTimer > 0) vehicle.stunTimer = Math.max(0, vehicle.stunTimer - dt);
    }
  }

  activate(vehicle, vehicles) {
    if (!vehicle || !vehicle.weapon) return false;
    const type = vehicle.weapon;
    vehicle.weapon = null;
    if (type === "nitro") {
      vehicle.boostTimer = Math.max(vehicle.boostTimer, 2.15);
      this.onMessage(vehicle.isPlayer ? "TURBO CELL ACTIVATED" : "");
      this.burst(vehicle.position, 0xffc857, 5);
      return true;
    }
    if (type === "shield") {
      vehicle.shieldTimer = 7;
      this.onMessage(vehicle.isPlayer ? "PHASE SHIELD ONLINE" : "");
      this.burst(vehicle.position, 0x42e8ff, 4);
      return true;
    }
    if (type === "shockwave") {
      let hits = 0;
      for (const target of vehicles) {
        if (target === vehicle || target.isRemote || target.finished) continue;
        if (target.position.distanceTo(vehicle.position) < 30) {
          if (target.shieldTimer > 0) target.shieldTimer = 0;
          else this.hit(target, vehicle);
          hits++;
        }
      }
      this.burst(vehicle.position, 0xb58cff, 13);
      this.onMessage(vehicle.isPlayer ? (hits ? "SHOCKWAVE HIT " + hits + " RIVAL(S)" : "SHOCKWAVE RELEASED") : "");
      return true;
    }
    if (type === "missile") {
      const candidates = vehicles.filter(target => target !== vehicle && !target.isRemote && !target.finished && target.totalProgress > vehicle.totalProgress);
      candidates.sort((a, b) => a.position.distanceToSquared(vehicle.position) - b.position.distanceToSquared(vehicle.position));
      const target = candidates[0];
      if (!target || target.position.distanceTo(vehicle.position) > 115) {
        this.onMessage(vehicle.isPlayer ? "NO TARGET IN RANGE" : "");
        vehicle.weapon = null;
        return false;
      }
      if (target.shieldTimer > 0) {
        target.shieldTimer = 0;
        this.burst(target.position, 0x42e8ff, 8);
        this.onMessage(vehicle.isPlayer ? "RIVAL SHIELD BROKE THE LOCK" : "");
      } else {
        this.hit(target, vehicle);
        this.burst(target.position, 0xff4d6d, 9);
        this.onMessage(vehicle.isPlayer ? "HOMING PULSE HIT " + target.name : "");
      }
      return true;
    }
    return false;
  }

  hit(target, attacker) {
    target.stunTimer = Math.max(target.stunTimer || 0, 1.65);
    target.speed *= 0.48;
    target.velocity.multiplyScalar(0.45);
    const away = target.position.clone().sub(attacker.position).setY(0).normalize();
    target.velocity.addScaledVector(away, 12);
  }

  burst(position, color, radius) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 18, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, wireframe: true })
    );
    mesh.position.copy(position);
    mesh.position.y += 1;
    mesh.scale.setScalar(1);
    this.scene.add(mesh);
    this.effects.push({ mesh, life: 0.55, duration: 0.55 });
  }

  dispose() {
    for (const pickup of this.pickups) {
      this.scene.remove(pickup.group);
      pickup.group.traverse(node => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          if (Array.isArray(node.material)) node.material.forEach(m => m.dispose());
          else node.material.dispose();
        }
      });
    }
    for (const effect of this.effects) {
      this.scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      effect.mesh.material.dispose();
    }
    this.pickups = [];
    this.effects = [];
  }
}

export { PowerUpManager, POWERUPS };
