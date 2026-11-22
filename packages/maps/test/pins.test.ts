// node-only
/**
 * @file What a pin is made of, without the DOM: which points draw, how they
 * group into clusters, where a cluster sits, its ring, the identity an active
 * pin answers, its icon and its key.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { clusterCenter, clusterPoints, clusterRing, finitePoints, isActivePin, pinIcon, pinId, pinKeys } from "../lib/pins.js";

const HERE = { lat: -22.9068, lng: -43.1729 };
const near = (i: number, extra: Record<string, unknown> = {}) => ({ lat: HERE.lat + i * 0.0001, lng: HERE.lng, id: `p${i}`, ...extra });

const kept = finitePoints([HERE, { lat: "x", lng: 1 }, { lat: 1 }, { lat: "-22.9", lng: "-43.1" }]);
eq("only the points with finite coordinates are placed", JSON.stringify(kept.map((p) => p.lat)), JSON.stringify([HERE.lat, "-22.9"]));

const points = [near(0), near(1), near(2), { lat: HERE.lat + 1, lng: HERE.lng, id: "far" }];
const low = clusterPoints(points, 10);
eq("near points group below zoom 14", JSON.stringify(low.map((g) => g.points.length).sort()), JSON.stringify([1, 3]));
eq("from zoom 14 every point stands alone", JSON.stringify(clusterPoints(points, 14).map((g) => g.points.length)), JSON.stringify([1, 1, 1, 1]));

const { lat, lng } = clusterCenter([near(0), near(2)]);
ok("a cluster centres on the mean of its points", Math.abs(lat - (HERE.lat + 0.0001)) < 1e-12);
eq("a cluster keeps the mean longitude", String(lng), String(HERE.lng));

const ring = clusterRing([near(0, { color: "red" }), near(1, { color: "red" }), near(2, { color: "blue" }), near(3)], "grey");
eq("a cluster rings its colours in proportion, largest first", ring, "conic-gradient(red 0.00% 50.00%,blue 50.00% 75.00%,grey 75.00% 100.00%)");

eq("an active id is read from the id", pinId({ id: 7, slug: "x" }), "7");
eq("an active id falls back to the slug", pinId({ slug: "x" }), "x");
eq("a matching active id is active", String(isActivePin({ slug: "x" }, "x")), "true");
eq("an empty active id is never active", String(isActivePin({ slug: "x" }, "")), "false");

eq("a known icon is drawn", pinIcon("music"), "music");
eq("a name that is not an icon falls back to the map pin", pinIcon("<script>"), "map-pin");
eq("no icon falls back to the map pin", pinIcon(undefined), "map-pin");

const keys = pinKeys([{ points: [near(0)] }, { points: [near(1), near(2)] }, { points: [near(0)] }, { points: [{ lat: 1, lng: 2 }] }]);
eq("keys name a pin by its point and a cluster by its lead and size, never twice", JSON.stringify(keys), JSON.stringify(["pin:p0", "cluster:p1:2", "pin:p0#1", "pin:1,2"]));

done();
