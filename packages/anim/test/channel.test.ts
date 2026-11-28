import { done, eqn, ok } from "@lightstart/test/assert.ts";
import { interpChannel, cubicBezier } from "../channel.js";

const near = (label: string, a: number | undefined, b: number, eps = 1e-9) => ok(label, Math.abs((a ?? NaN) - b) <= eps);

near("interpChannel: linear midpoint", interpChannel([{ t: 0, value: 0 }, { t: 1000, value: 10 }], 500), 5);

{
  const ch = [{ t: 100, value: 2 }, { t: 200, value: 4 }];
  near("interpChannel: clamps before its range", interpChannel(ch, 0), 2);
  near("interpChannel: clamps after its range", interpChannel(ch, 9999), 4);
}

near("interpChannel: per-segment easing (easeOut(0.5)=0.75)", interpChannel([{ t: 0, value: 0, easing: "easeOut" }, { t: 1000, value: 1 }], 500), 0.75);

near("interpChannel: multi-segment picks the right segment", interpChannel([{ t: 0, value: 0 }, { t: 100, value: 10 }, { t: 200, value: 0 }], 150), 5);

{
  const f = cubicBezier(0.25, 0.1, 0.25, 1);
  eqn("cubicBezier: starts at 0", f(0), 0);
  eqn("cubicBezier: ends at 1", f(1), 1);
  ok("cubicBezier: middle stays inside", f(0.5) > 0 && f(0.5) < 1);
}

{
  const v = interpChannel([{ t: 0, value: 0, bezier: [0.25, 0.1, 0.25, 1] }, { t: 100, value: 1 }], 50);
  ok("interpChannel: cubic-bezier segment stays between its points", v != null && v > 0 && v < 1);
}

done();
