// node-only
/**
 * @file Tile-coverage arithmetic: the full pyramid over a bbox, per-point
 * squares above it, the sparse index that answers which patch tiles exist,
 * and the zoom bands a manifest implies.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { coverageTiles, manifestZooms, sparseTileExists } from "../coverage.js";

const RIOISH = { west: -43.4, east: -43.1, south: -23.05, north: -22.8 };

const pyramid = coverageTiles({ bbox: RIOISH, points: [], fullMin: 8, fullMax: 9, nearMax: 9 });
ok("the pyramid covers some tiles", pyramid.size > 0);
let banded = true;
for (const key of pyramid) {
  const z = Number(key.split("/")[0]);
  if (z !== 8 && z !== 9) banded = false;
}
ok("every pyramid tile is at the full bands", banded);

const point = { lat: -22.9, lng: -43.2 };
const patch = coverageTiles({ bbox: null, points: [point], fullMin: 8, fullMax: 9, nearMax: 10, radius: 1 });
const z10 = [...patch].filter((key) => key.startsWith("10/"));
eq("a radius of one asks for a three-by-three square", String(z10.length), "9");
eq("nothing below fullMax is added", String(patch.size), "9");

const edge = coverageTiles({ bbox: null, points: [{ lat: 85, lng: -179.9 }], fullMin: 1, fullMax: 1, nearMax: 2, radius: 2 });
let clamped = true;
for (const key of edge) {
  const [, x, y] = key.split("/").map(Number);
  if (!(x >= 0 && x <= 3 && y >= 0 && y <= 3)) clamped = false;
}
ok("radius squares clamp at the world edge instead of wrapping", clamped);

eq("nothing at or below fullZoomMax is missing", String(sparseTileExists(null, undefined, 12, 1, 1)), "true");
eq("a sparse index is not consulted at the full bands", String(sparseTileExists({ 14: {} }, 13, 13, 1, 1)), "true");

const sparse: import("../types.ts").SparseIndex = { 14: { 5: [[10, 12], [20, 20]] } };
eq("a row inside a run exists", String(sparseTileExists(sparse, 13, 14, 5, 11)), "true");
eq("a run's last row exists", String(sparseTileExists(sparse, 13, 14, 5, 20)), "true");
eq("a hole between runs does not exist", String(sparseTileExists(sparse, 13, 14, 5, 15)), "false");
eq("a column with no run does not exist", String(sparseTileExists(sparse, 13, 14, 6, 11)), "false");

eq("a null manifest uses the bake defaults", JSON.stringify(manifestZooms(null)), JSON.stringify({ minZoom: 8, fullMax: 13, maxZoom: 14 }));
eq("a manifest's bands are kept", JSON.stringify(manifestZooms({ minZoom: 6, fullZoomMax: 10, maxZoom: 12 })), JSON.stringify({ minZoom: 6, fullMax: 10, maxZoom: 12 }));
eq("a missing full band fills in from maxZoom", JSON.stringify(manifestZooms({ maxZoom: 11 })), JSON.stringify({ minZoom: 8, fullMax: 11, maxZoom: 11 }));

done();
