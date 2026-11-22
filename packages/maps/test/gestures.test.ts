// node-only
/**
 * @file What a pointer, a wheel or a pair of fingers asks of the map: a pinch
 * step, a double tap, a wheel step's zoom, and the tap threshold.
 */

import { done, eq } from "@lightstart/test/assert.ts";
import { TAP_THRESHOLD_PX, isDoubleTap, pinchIntent, wheelZoomDelta } from "../lib/gestures.js";

eq("a pinch reads the midpoint's travel, where it is, the spread and the drag", JSON.stringify(pinchIntent({ x: 110, y: 100 }, { x: 130, y: 100 }, { x: 90, y: 100 })), JSON.stringify({ dx: 10, dy: 0, x: 110, y: 100, scale: 2, moved: 30 }));

const apart = pinchIntent({ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 0 });
eq("a pinch guards a spread of zero", String(apart.scale), "5");
const together = pinchIntent({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
eq("a pinch that closes scales down", String(together.scale), "0.2");

const first = { t: 1000, x: 50, y: 50 };
eq("a first tap is no double tap", String(isDoubleTap(null, first)), "false");
eq("a second tap inside 300 ms and 30 px is a double tap", String(isDoubleTap(first, { t: 1299, x: 70, y: 70 })), "true");
eq("a tap at exactly 300 ms is not a double tap", String(isDoubleTap(first, { t: 1300, x: 50, y: 50 })), "false");
eq("a tap beyond 30 px is not a double tap", String(isDoubleTap(first, { t: 1100, x: 80, y: 50 })), "false");

eq("a wheel zooms 0.0025 per unit", String(wheelZoomDelta(100, false)), "-0.25");
eq("a wheel the other way zooms in", String(wheelZoomDelta(-100, false)), "0.25");
eq("a ctrl-wheel zooms four times faster", String(wheelZoomDelta(-50, true)), "0.5");

eq("a tap is told from a drag at 5 px", String(TAP_THRESHOLD_PX), "5");

done();
