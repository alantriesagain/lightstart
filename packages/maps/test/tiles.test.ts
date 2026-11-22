// node-only
/**
 * @file Tile arithmetic for a camera: the level that draws, its origin, the
 * visible range, eviction, the numeric key, the level transform, the tile URL
 * and its pixel offset.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import {
  MAX_TILES_PER_LEVEL,
  activeLevel,
  levelOrigin,
  levelTransform,
  outsideMargin,
  tileKey,
  tileOffset,
  tileSrc,
  tileX,
  tileY,
  visibleRange,
} from "../lib/tiles.js";

const VIEW = { w: 400, h: 300 };
const LIMITS = { minZoom: 2, maxZoom: 18 };
type Camera = Partial<import("../types.ts").MapCamera>;
type CameraFull = import("../types.ts").MapCamera;
const cam = (over: Camera = {}): CameraFull => ({ cx: 0.5, cy: 0.5, zoom: 3, zTarget: 3, anchorX: 0, anchorY: 0, ...over });

eq("the level nearest below a fractional zoom draws", String(activeLevel(cam({ zoom: 3.4 }), LIMITS)), "3");
eq("the level nearest above draws", String(activeLevel(cam({ zoom: 3.5 }), LIMITS)), "4");
eq("a zoom under the floor draws the floor", String(activeLevel(cam({ zoom: 1 }), LIMITS)), "2");
eq("a zoom over the ceiling draws the ceiling", String(activeLevel(cam({ zoom: 19.2 }), { minZoom: 2, maxZoom: 14 })), "14");

eq("a level is placed from the tile under the centre", JSON.stringify(levelOrigin(cam({ cx: 0.3, cy: 0.7 }), 4)), JSON.stringify({ ox: 4, oy: 11 }));

eq("a viewport is covered by the tiles it shows", JSON.stringify(visibleRange(cam(), VIEW, 3, null)), JSON.stringify({ x0: 3, x1: 4, y0: 3, y1: 4 }));
eq("a fractional zoom shows the next level's spread", JSON.stringify(visibleRange(cam({ zoom: 2.5 }), VIEW, 3, null)), JSON.stringify({ x0: 2, x1: 5, y0: 3, y1: 4 }));

eq("a range stops at the world's edge", JSON.stringify(visibleRange(cam({ cx: 0, cy: 1 }), VIEW, 3, null)), JSON.stringify({ x0: 0, x1: 0, y0: 7, y1: 7 }));
eq("a bounded range stops at the bounds", JSON.stringify(visibleRange(cam(), VIEW, 3, { x0: 4, x1: 6, y0: 0, y1: 3 })), JSON.stringify({ x0: 4, x1: 4, y0: 3, y1: 3 }));

const range = { x0: 10, x1: 12, y0: 20, y1: 21 };
eq("a tile two outside the range is kept", String(outsideMargin(range, 8, 18)), "false");
eq("a tile two past the far side is kept", String(outsideMargin(range, 14, 23)), "false");
eq("a tile three outside is evicted", String(outsideMargin(range, 7, 20)), "true");
eq("a tile three past the far side is evicted", String(outsideMargin(range, 12, 24)), "true");
eq("a level keeps at most 350 tiles", String(MAX_TILES_PER_LEVEL), "350");

const key = tileKey(18, 97000, 148000);
eq("a key reads back its column", String(tileX(18, key)), "97000");
eq("a key reads back its row", String(tileY(18, key)), "148000");
ok("a key tells a transposed tile apart", tileKey(3, 1, 2) !== tileKey(3, 2, 1));

eq("a level moves into place", levelTransform(cam(), VIEW, { z: 3, ox: 4, oy: 4 }), "translate3d(200px,150px,0) scale(1)");
eq("a level scales to the camera's zoom", levelTransform(cam({ zoom: 4 }), VIEW, { z: 3, ox: 3, oy: 4 }), "translate3d(-312px,150px,0) scale(2)");

eq("a tile template is filled", tileSrc("/tiles/{z}/{x}/{y}.png", 3, 4, 5), "/tiles/3/4/5.png");
eq("a subdomain and suffix are filled", tileSrc("https://{s}.basemaps.example/{z}/{x}/{y}{r}.png", 12, 1, 2), "https://a.basemaps.example/12/1/2.png");

eq("a tile is offset from its level's origin", String(tileOffset(6, 4)), "512");
eq("a tile before the origin offsets backwards", String(tileOffset(3, 4)), "-256");

done();
