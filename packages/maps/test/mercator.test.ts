// node-only
/**
 * @file Web Mercator math: the projection and its inverse, the world size,
 * tile indices, the tile range, a fit, the bbox of points and the dense focus
 * bbox, plus great-circle distance.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import {
  TILE_SIZE,
  bboxOfPoints,
  boundsToCenterZoom,
  distanceMeters,
  focusBboxOfPoints,
  lngLatToWorld,
  tileRange,
  worldSize,
  worldToLngLat,
  worldToTile,
} from "../mercator.js";

const IPANEMA = { lat: -22.9873109, lng: -43.2021257 };

const RIO_CLUSTER = [
  { lat: -22.9873109, lng: -43.2021257 },
  { lat: -22.98946, lng: -43.19317 },
  { lat: -22.9576, lng: -43.2104 },
  { lat: -22.89749, lng: -43.18553 },
  { lat: -22.9772, lng: -43.1873 },
  { lat: -22.9068, lng: -43.1729 },
  { lat: -22.9519, lng: -43.2105 },
  { lat: -22.9836, lng: -43.2044 },
  { lat: -22.9484, lng: -43.1993 },
  { lat: -22.9935, lng: -43.2715 },
  { lat: -22.9146, lng: -43.1976 },
  { lat: -22.9698, lng: -43.1868 },
  { lat: -22.9312, lng: -43.1809 },
];

const OUTLIERS = [
  { lat: -23.2178, lng: -44.7131 },
  { lat: -23.2265, lng: -44.7208 },
  { lat: -23.1416, lng: -44.1712 },
  { lat: -23.1502, lng: -44.16 },
  { lat: -22.7469, lng: -41.8817 },
  { lat: -22.7553, lng: -41.8874 },
  { lat: -22.75, lng: -41.89 },
  { lat: -23.2, lng: -44.7 },
];

const [x, y] = lngLatToWorld(IPANEMA.lng, IPANEMA.lat);
ok("a point projects inside the world", x > 0 && x < 1 && y > 0 && y < 1);
const [lng, lat] = worldToLngLat(x, y);
ok("the longitude round-trips", Math.abs(lng - IPANEMA.lng) < 1e-9);
ok("the latitude round-trips", Math.abs(lat - IPANEMA.lat) < 1e-9);

const [, yNorth] = lngLatToWorld(0, 89);
const [, ySouth] = lngLatToWorld(0, -89);
ok("a latitude beyond the range is clamped", yNorth >= 0 && ySouth <= 1);

eq("the world is one tile at zoom zero", String(worldSize(0)), String(TILE_SIZE));
eq("the world is eight tiles at zoom three", String(worldSize(3)), String(TILE_SIZE * 8));
ok("the world doubles per zoom", Math.abs(worldSize(2.5) / worldSize(1.5) - 2) < 1e-12);

eq("Ipanema hits its known tile at zoom eleven", JSON.stringify(worldToTile(x, y, 11)), JSON.stringify([778, 1158]));
eq("a tile index clamps to the grid", JSON.stringify(worldToTile(-0.1, 1.5, 3)), JSON.stringify([0, 7]));

const rio = tileRange({ west: -44.76, south: -23.27, east: -41.83, north: -22.7 }, 13);
ok("a tile range is ordered", rio.x1 >= rio.x0 && rio.y1 >= rio.y0);
const count = (rio.x1 - rio.x0 + 1) * (rio.y1 - rio.y0 + 1);
ok("the Rio bbox covers a contiguous block at zoom thirteen", count > 500 && count < 1500);

const bbox = { west: -44.76, south: -23.27, east: -41.83, north: -22.7 };
const fit = boundsToCenterZoom(bbox, 1100, 600, 40, 15);
const scale = worldSize(fit.zoom);
const [fx0, fy0] = lngLatToWorld(bbox.west, bbox.north);
const [fx1, fy1] = lngLatToWorld(bbox.east, bbox.south);
ok("a fit holds the bbox across the width", (fx1 - fx0) * scale <= 1100 - 2 * 40 + 1e-6);
ok("a fit holds the bbox down the height", (fy1 - fy0) * scale <= 600 - 2 * 40 + 1e-6);
ok("a fit centres inside the bbox", fit.cx > fx0 && fit.cx < fx1 && fit.cy > fy0 && fit.cy < fy1);
eq("a tiny bbox fits at the max zoom", String(boundsToCenterZoom({ west: -43.2, south: -22.99, east: -43.199, north: -22.989 }, 1100, 600, 40, 15).zoom), "15");

const spanned = bboxOfPoints([{ lat: -22.9, lng: -43.2 }, { lat: "junk", lng: -10 }, { lat: -23.1, lng: -44.1 }]);
eq("the bbox filters bad coordinates and spans the set", JSON.stringify(spanned), JSON.stringify({ west: -44.1, south: -23.1, east: -43.2, north: -22.9 }));
eq("a set with no finite coordinate has no bbox", String(bboxOfPoints([{ lat: NaN, lng: NaN }])), "null");

const focused = focusBboxOfPoints([...RIO_CLUSTER, ...OUTLIERS]);
const inside = (p: { lat: number; lng: number }) => focused !== null && p.lng >= focused.west && p.lng <= focused.east && p.lat >= focused.south && p.lat <= focused.north;
ok("the focus bbox keeps the dense cluster", RIO_CLUSTER.filter(inside).length >= RIO_CLUSTER.length - 1);
eq("the focus bbox drops every outlier", String(OUTLIERS.filter(inside).length), "0");

const tiny = [{ lat: -22.9, lng: -43.2 }, { lat: -23.2, lng: -44.7 }];
eq("a tiny set degrades to the full bbox", JSON.stringify(focusBboxOfPoints(tiny)), JSON.stringify(bboxOfPoints(tiny)));

const arpoador = { lat: -22.9889, lng: -43.1926 };
const forte = { lat: -22.9865, lng: -43.1875 };
const near = distanceMeters(arpoador, forte);
ok("neighbouring points are a few hundred metres apart", near > 500 && near < 700);
eq("a point is zero from itself", String(distanceMeters(arpoador, arpoador)), "0");
const far = distanceMeters(arpoador, { lat: "-22.9871", lng: "-43.2252" });
ok("across Ipanema is a few kilometres", far > 3000 && far < 3600);

done();
