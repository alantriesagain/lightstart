// node-only
/**
 * @file Fling physics: the sample window kept, the velocity a release
 * carries, the span and speed floors, and the per-frame decay.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { MAX_SAMPLES, pushSample, releaseVelocity, stepInertia } from "../lib/inertia.js";

const drag = (count: number, every: number, dx = 4, dy = 0) =>
  Array.from({ length: count }, (_, i) => ({ t: i * every, dx, dy }));

const samples: import("../types.ts").VelocitySample[] = [];
for (let i = 0; i < 20; i++) pushSample(samples, { t: i, dx: i, dy: 0 });
eq("twelve samples are kept", String(MAX_SAMPLES), "12");
eq("only the last twelve survive", String(samples.length), "12");
eq("the oldest is the eighth", String(samples[0]?.t), "8");
eq("the newest is the nineteenth", String(samples[11]?.t), "19");

eq("a release carries the travel over the last 100 ms", JSON.stringify(releaseVelocity(drag(5, 16), 80)), JSON.stringify({ vx: 0.25, vy: 0 }));
const old = [{ t: 0, dx: 400, dy: 0 }, ...drag(5, 16).map((s) => ({ ...s, t: s.t + 200 }))];
eq("samples older than the window are ignored", JSON.stringify(releaseVelocity(old, 280)), JSON.stringify({ vx: 0.25, vy: 0 }));

eq("a span of 20 ms releases nothing", String(releaseVelocity(drag(2, 10), 20)), "null");
eq("no samples releases nothing", String(releaseVelocity([], 80)), "null");
eq("a release long after the drag releases nothing", String(releaseVelocity(drag(3, 16), 500)), "null");

eq("a release at 0.05 px/ms or slower releases nothing", String(releaseVelocity(drag(5, 16, 0.8), 80)), "null");
eq("an upward release carries a negative vertical speed", JSON.stringify(releaseVelocity(drag(5, 16, 0, -1), 80)), JSON.stringify({ vx: 0, vy: -0.0625 }));

const next = stepInertia({ vx: 1, vy: 0 }, 16.7);
ok("a fling survives its first frame", next !== null);
ok("the fling decays by 0.94 per frame", next !== null && Math.abs(next.vx - 0.94) < 1e-12);
const twice = stepInertia({ vx: 1, vy: 0 }, 33.4);
ok("two frames decay by 0.94 squared", twice !== null && Math.abs(twice.vx - 0.94 ** 2) < 1e-12);
eq("a zero frame changes nothing", JSON.stringify(stepInertia({ vx: 1, vy: 0 }, 0)), JSON.stringify({ vx: 1, vy: 0 }));
eq("a speed under 0.01 stops", String(stepInertia({ vx: 0.0105, vy: 0 }, 16.7)), "null");

done();
