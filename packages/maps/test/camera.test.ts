// node-only
/**
 * @file The camera without the DOM: easing, clamping, screen and world
 * conversion, panning, anchored and pinch zoom, the eased target, flights and
 * fits.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { lngLatToWorld, worldSize } from "../mercator.js";
import {
  ZOOM_EPSILON,
  anchoredZoom,
  approachZoomTarget,
  clampCenter,
  clampNum,
  clampZoom,
  createFlight,
  easeInOutCubic,
  fitCamera,
  flightAt,
  panBy,
  pinchZoom,
  screenToWorld,
  worldToScreen,
  zoomTarget,
} from "../lib/camera.js";

const VIEW = { w: 400, h: 300 };
const LIMITS = { minZoom: 2, maxZoom: 18 };
type Camera = Partial<import("../types.ts").MapCamera>;
type CameraFull = import("../types.ts").MapCamera;
const cam = (over: Camera = {}): CameraFull => ({ cx: 0.5, cy: 0.5, zoom: 3, zTarget: 3, anchorX: 0, anchorY: 0, ...over });
const close = (name: string, a: number, b: number, eps = 1e-12) => ok(name, Math.abs(a - b) <= eps);

eq("easing starts at zero", String(easeInOutCubic(0)), "0");
eq("easing passes the midpoint", String(easeInOutCubic(0.5)), "0.5");
eq("easing ends at one", String(easeInOutCubic(1)), "1");
eq("easing eases a quarter to a sixteenth", String(easeInOutCubic(0.25)), "0.0625");

eq("a number clamps above", String(clampNum(5, 0, 3)), "3");
eq("a number clamps below", String(clampNum(-1, 0, 3)), "0");
eq("a zoom clamps at the floor", String(clampZoom(1, LIMITS)), "2");
eq("a zoom clamps at the ceiling", String(clampZoom(19, LIMITS)), "18");
eq("a zoom inside is kept", String(clampZoom(7.5, LIMITS)), "7.5");

const unclamped = cam();
ok("the camera comes back itself when nothing needs clamping", clampCenter(unclamped, VIEW, null) === unclamped);

const world = { x0: 0.4, y0: 0.4, x1: 0.6, y1: 0.6 };
const pulled = clampCenter(cam({ cx: 0.3, cy: 0.7, zoom: 10 }), VIEW, world);
const scale = worldSize(10);
close("the camera is pulled to the left edge", pulled.cx, 0.4 + 200 / scale);
close("the camera is pulled to the bottom edge", pulled.cy, 0.6 - 150 / scale);

const narrow = { x0: 0.4, y0: 0.45, x1: 0.41, y1: 0.46 };
const centred = clampCenter(cam({ cx: 0.1, cy: 0.9, zoom: 3 }), VIEW, narrow);
close("a viewport wider than the bounds centres on them across", centred.cx, 0.405);
close("a viewport taller than the bounds centres on them down", centred.cy, 0.455);

const camera = cam({ cx: 0.3, cy: 0.6, zoom: 5 });
const [wx, wy] = screenToWorld(camera, VIEW, 50, 260);
const [px, py] = worldToScreen(camera, VIEW, wx, wy);
close("screen to world and back keeps x", px, 50, 1e-9);
close("screen to world and back keeps y", py, 260, 1e-9);
const out = [0, 0];
ok("worldToScreen writes into the answer it is given", worldToScreen(camera, VIEW, 0.3, 0.6, out) === out);
eq("the centre projects to the middle", JSON.stringify(out), JSON.stringify([200, 150]));

const panned = panBy(cam({ zoom: 0 }), 256, -128);
close("panning right moves the world left", panned.cx, -0.5);
close("panning up moves the world down", panned.cy, 1);

const anchored = cam({ cx: 0.3, cy: 0.6, zoom: 5 });
const before = screenToWorld(anchored, VIEW, 320, 40);
const zoomed = anchoredZoom(anchored, VIEW, 7.25, 320, 40);
const after = screenToWorld(zoomed, VIEW, 320, 40);
eq("an anchored zoom takes the new zoom", String(zoomed.zoom), "7.25");
close("the anchored world point holds its x", after[0], before[0]);
close("the anchored world point holds its y", after[1], before[1]);

const pinched = pinchZoom(cam({ zoom: 5, zTarget: 5 }), VIEW, LIMITS, { dx: 0, dy: 0, x: 200, y: 150, scale: 2, moved: 10 });
eq("a pinch zooms by the spread", String(pinched.zoom), "6");
eq("a pinch settles its target there", String(pinched.zTarget), "6");
close("a pinch at the middle keeps the centre", pinched.cx, 0.5);
const capped = pinchZoom(cam({ zoom: 18, zTarget: 18 }), VIEW, LIMITS, { dx: 0, dy: 0, x: 0, y: 0, scale: 4, moved: 0 });
eq("a pinch stops at the ceiling", String(capped.zoom), "18");

const aimed = zoomTarget(cam(), LIMITS, 30, 12, 34);
eq("a zoom target clamps, anchors and keeps the zoom", JSON.stringify([aimed.zTarget, aimed.anchorX, aimed.anchorY, aimed.zoom]), JSON.stringify([18, 12, 34, 3]));

const approaching = cam({ zoom: 3, zTarget: 4, anchorX: 200, anchorY: 150 });
const step = approachZoomTarget(approaching, VIEW, 16);
close("the target is approached by 1 - exp(-dt * 0.012)", step.zoom, 3 + (1 - Math.exp(-16 * 0.012)));
eq("the target stays put while approaching", String(step.zTarget), "4");
const snapped = approachZoomTarget(cam({ zoom: 4 - ZOOM_EPSILON / 2, zTarget: 4 }), VIEW, 16);
eq("the target snaps once inside the epsilon", String(snapped.zoom), "4");
const idle = cam();
ok("an idle camera comes back itself", approachZoomTarget(idle, VIEW, 16) === idle);

const flight = createFlight(cam({ cx: 0.2, cy: 0.4, zoom: 4 }), { cx: 0.6, cy: 0.8, zoom: 10 }, 1000, 400);
eq("a flight starts where the camera was", JSON.stringify(flight.from), JSON.stringify({ cx: 0.2, cy: 0.4, zoom: 4 }));
const mid = flightAt(flight, 1200);
close("a flight is halfway across at its middle", mid.cx, 0.4);
close("a flight is halfway down at its middle", mid.cy, 0.6);
close("a flight is halfway in at its middle", mid.zoom, 7);
eq("a flight has not landed at its middle", String(mid.done), "false");
eq("a flight before it starts is still at the start", JSON.stringify(flightAt(flight, 900)), JSON.stringify({ cx: 0.2, cy: 0.4, zoom: 4, done: false }));
eq("a flight past its end is at the destination", JSON.stringify(flightAt(flight, 1500)), JSON.stringify({ cx: 0.6, cy: 0.8, zoom: 10, done: true }));

const bbox = { west: -43.3, south: -23.0, east: -43.1, north: -22.8 };
const fit = fitCamera(bbox, VIEW, LIMITS, { padding: 24, maxZoom: 15 });
const [x0, y0] = lngLatToWorld(bbox.west, bbox.north);
const [x1, y1] = lngLatToWorld(bbox.east, bbox.south);
close("a fit centres across the bbox", fit.cx, (x0 + x1) / 2);
close("a fit centres down the bbox", fit.cy, (y0 + y1) / 2);
eq("a fit lands on a whole zoom", String(fit.zoom), "10");
const point = { west: -43.2, south: -22.9, east: -43.2, north: -22.9 };
eq("a tiny bbox stops at the fit's maxZoom", String(fitCamera(point, VIEW, LIMITS, { padding: 24, maxZoom: 15 }).zoom), "15");
eq("a tiny bbox stops at the map's ceiling", String(fitCamera(point, VIEW, { minZoom: 2, maxZoom: 12 }, { padding: 24, maxZoom: 15 }).zoom), "12");

done();
