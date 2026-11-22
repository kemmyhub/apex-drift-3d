import test from "node:test";
import assert from "node:assert/strict";
import { TRACK_CATALOG } from "../src/game/TrackCatalog.js";
import { createTrackMapProjection, projectTrackMapMarkers } from "../src/game/TrackMap.js";

test("every catalog circuit fits within square and landscape map canvases without distortion", () => {
    for (const track of TRACK_CATALOG) {
        for (const [width, height] of [[150, 150], [240, 96]]) {
            const padding = 12;
            const worldPadding = track.roadWidth / 2 + 5;
            const projection = createTrackMapProjection(track.points, width, height, padding, worldPadding);
            assert.equal(projection.scaleX, projection.scaleY, `${track.id} must use a uniform scale`);
            for (const [x, , z] of track.points) {
                const mapped = projection.project(x, z);
                assert.ok(mapped.x >= padding - 1e-8 && mapped.x <= width - padding + 1e-8, `${track.id} x point clipped`);
                assert.ok(mapped.y >= padding - 1e-8 && mapped.y <= height - padding + 1e-8, `${track.id} z point clipped`);
            }
            const { minX, maxX, minZ, maxZ } = projection.bounds;
            assert.equal(minX, Math.min(...track.points.map(point => point[0])) - worldPadding);
            assert.equal(maxX, Math.max(...track.points.map(point => point[0])) + worldPadding);
            assert.equal(minZ, Math.min(...track.points.map(point => point[2])) - worldPadding);
            assert.equal(maxZ, Math.max(...track.points.map(point => point[2])) + worldPadding);
        }
    }
});

test("map projection accepts sampled vector-like route points and rejects invalid input", () => {
    const projection = createTrackMapProjection([{ x: -5, z: 4 }, { x: 5, z: -4 }], 100, 100);
    assert.ok(projection.project(0, 0).x > 0);
    assert.throws(() => createTrackMapProjection([], 100, 100), RangeError);
});

test("boost and checkpoint markers share the route projection and remain within padded bounds", () => {
    const route = [[-20, 0, -10], [20, 0, 10]];
    const projection = createTrackMapProjection(route, 180, 120, 12, 8);
    const markers = projectTrackMapMarkers([
        { type: "boost", position: { x: -20, z: -10 } },
        { type: "checkpoint", index: 3, position: { x: 20, z: 10 } }
    ], projection);
    assert.equal(markers[0].type, "boost");
    assert.equal(markers[1].index, 3);
    for (const marker of markers) {
        assert.ok(marker.x >= 12 && marker.x <= 168);
        assert.ok(marker.y >= 12 && marker.y <= 108);
    }
    assert.ok(markers[0].x < markers[1].x);
    assert.ok(markers[0].y > markers[1].y);
});
