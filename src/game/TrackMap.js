function pointCoordinates(point) {
    if (Array.isArray(point)) return { x: Number(point[0]), z: Number(point[2] ?? point[1]) };
    return { x: Number(point?.x), z: Number(point?.z) };
}

/** Project world-space marker positions through the same transform used by the route. */
export function projectTrackMapMarkers(markers, projection) {
    return markers.map(marker => {
        const { x, z } = pointCoordinates(marker.position);
        return { ...marker, ...projection.project(x, z) };
    });
}

/** Fit a route into a canvas without clipping or stretching its shape. */
export function createTrackMapProjection(points, width, height, padding = 12, worldPadding = 0) {
    const valid = points.map(pointCoordinates).filter(point => Number.isFinite(point.x) && Number.isFinite(point.z));
    if (!valid.length || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new RangeError("A track map needs finite route points and positive canvas dimensions.");
    }

    const extra = Math.max(0, Number(worldPadding) || 0);
    const minX = Math.min(...valid.map(point => point.x)) - extra;
    const maxX = Math.max(...valid.map(point => point.x)) + extra;
    const minZ = Math.min(...valid.map(point => point.z)) - extra;
    const maxZ = Math.max(...valid.map(point => point.z)) + extra;
    const rangeX = Math.max(1, maxX - minX);
    const rangeZ = Math.max(1, maxZ - minZ);
    const safePadding = Math.max(0, Math.min(padding, (width - 1) / 2, (height - 1) / 2));
    const availableWidth = Math.max(1, width - safePadding * 2);
    const availableHeight = Math.max(1, height - safePadding * 2);
    const scale = Math.min(availableWidth / rangeX, availableHeight / rangeZ);
    const drawnWidth = rangeX * scale;
    const drawnHeight = rangeZ * scale;
    const offsetX = (width - drawnWidth) / 2;
    const offsetY = (height - drawnHeight) / 2;

    return {
        scale,
        scaleX: scale,
        scaleY: scale,
        bounds: { minX, maxX, minZ, maxZ },
        project(x, z) {
            return {
                x: offsetX + (x - minX) * scale,
                y: height - (offsetY + (z - minZ) * scale)
            };
        }
    };
}
