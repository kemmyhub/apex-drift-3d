function forwardSpeed(vehicle) {
    const forwardX = Math.sin(vehicle.heading || 0);
    const forwardZ = Math.cos(vehicle.heading || 0);
    return vehicle.velocity.x * forwardX + vehicle.velocity.z * forwardZ;
}

function stableVehicleKey(vehicle) {
    if (vehicle.id !== undefined && vehicle.id !== null) return String(vehicle.id);
    return [vehicle.position.x, vehicle.position.z, vehicle.velocity.x, vehicle.velocity.z, vehicle.heading || 0].join(":");
}

/** Resolve pairs in stable identity order so array permutations produce the same clustered response. */
export function resolveVehicleCollisions(vehicles, onPlayerImpact = null, minimumSeparation = 2.8, restitution = 0.18) {
    const impacts = [];
    const ordered = [...vehicles].sort((a, b) => stableVehicleKey(a).localeCompare(stableVehicleKey(b)));
    for (let firstIndex = 0; firstIndex < ordered.length; firstIndex += 1) {
        const first = ordered[firstIndex];
        for (let secondIndex = firstIndex + 1; secondIndex < ordered.length; secondIndex += 1) {
            const second = ordered[secondIndex];
            let dx = first.position.x - second.position.x;
            let dz = first.position.z - second.position.z;
            let distance = Math.hypot(dx, dz);
            if (distance >= minimumSeparation) continue;

            if (distance < 1e-8) {
                // Stable identity chooses a reproducible axis even when cars coincide.
                dx = 1;
                dz = 0;
                distance = 0;
            }
            const normalLength = Math.hypot(dx, dz) || 1;
            const nx = dx / normalLength;
            const nz = dz / normalLength;
            const inverseFirst = first.isRemote ? 0 : 1;
            const inverseSecond = second.isRemote ? 0 : 1;
            const inverseTotal = inverseFirst + inverseSecond;
            if (inverseTotal === 0) continue;

            const overlap = minimumSeparation - distance;
            first.position.x += nx * overlap * inverseFirst / inverseTotal;
            first.position.z += nz * overlap * inverseFirst / inverseTotal;
            second.position.x -= nx * overlap * inverseSecond / inverseTotal;
            second.position.z -= nz * overlap * inverseSecond / inverseTotal;

            const relativeNormalSpeed = (first.velocity.x - second.velocity.x) * nx + (first.velocity.z - second.velocity.z) * nz;
            let impulseMagnitude = 0;
            if (relativeNormalSpeed < 0) {
                impulseMagnitude = -(1 + restitution) * relativeNormalSpeed / inverseTotal;
                first.velocity.x += impulseMagnitude * inverseFirst * nx;
                first.velocity.z += impulseMagnitude * inverseFirst * nz;
                second.velocity.x -= impulseMagnitude * inverseSecond * nx;
                second.velocity.z -= impulseMagnitude * inverseSecond * nz;
            }
            if (!first.isRemote) first.speed = forwardSpeed(first);
            if (!second.isRemote) second.speed = forwardSpeed(second);
            if ((first.isPlayer || second.isPlayer) && impulseMagnitude > 1e-3) {
                const player = first.isPlayer ? first : second;
                const other = first.isPlayer ? second : first;
                impacts.push({ player, other, impulse: impulseMagnitude });
                onPlayerImpact?.(player, other, impulseMagnitude);
            }
        }
    }
    return impacts;
}
