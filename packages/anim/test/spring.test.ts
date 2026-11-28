import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { sampleSpring, simplifyChannel, springChannel, springDurationMs } from "../spring.js";

{
  const points = sampleSpring({ from: 0, to: 1 });
  eqn("sampleSpring: starts at t=0", points[0].t, 0);
  eqn("sampleSpring: starts at from", points[0].value, 0);
  eqn("sampleSpring: settles exactly at to", points[points.length - 1].value, 1);
  ok("sampleSpring: returns more than five points", points.length > 5);
}

{
  const points = sampleSpring({ from: 0, to: 1, damping: 12 });
  const peak = Math.max(...points.map((p) => p.value));
  ok("sampleSpring: default config overshoots past target", peak > 1.02);
}

{
  const points = sampleSpring({ from: 0, to: 1, stiffness: 120, damping: 40 });
  const peak = Math.max(...points.map((p) => p.value));
  ok("sampleSpring: heavy damping never overshoots", peak <= 1.001);
}

eq("sampleSpring: deterministic", JSON.stringify(sampleSpring({ from: 0.8, to: 1 })), JSON.stringify(sampleSpring({ from: 0.8, to: 1 })));

eq("sampleSpring: no-op spring is a single point", JSON.stringify(sampleSpring({ from: 1, to: 1 })), JSON.stringify([{ t: 0, value: 1 }]));

{
  const points = sampleSpring({ from: 0, to: 1, damping: 0.5, maxDurationMs: 2000 });
  ok("sampleSpring: respects maxDurationMs", points[points.length - 1].t <= 2000);
}

{
  const dense = Array.from({ length: 11 }, (_, i) => ({ t: i * 100, value: i }));
  const out = simplifyChannel(dense, 0.001);
  eq("simplifyChannel: keeps endpoints, drops collinear middles", JSON.stringify(out), JSON.stringify([{ t: 0, value: 0 }, { t: 1000, value: 10 }]));
}

{
  const corner = [
    { t: 0, value: 0 }, { t: 100, value: 1 }, { t: 200, value: 2 },
    { t: 300, value: 1 }, { t: 400, value: 0 },
  ];
  const out = simplifyChannel(corner, 0.01);
  ok("simplifyChannel: keeps a genuine corner", out.some((p) => p.t === 200 && p.value === 2));
}

{
  const config = { from: 0, to: 1, damping: 14 };
  const dense = sampleSpring(config);
  const baked = springChannel(config);
  ok("springChannel: compacts a dense sample", baked.length < dense.length / 2);
  ok("springChannel: stays under forty points", baked.length <= 40);
  eq("springChannel: keeps the first point", JSON.stringify(baked[0]), JSON.stringify(dense[0]));
  eq("springChannel: keeps the last point", JSON.stringify(baked[baked.length - 1]), JSON.stringify(dense[dense.length - 1]));
}

{
  const config = { from: 0, to: 1, damping: 20 };
  const dense = sampleSpring(config);
  eqn("springDurationMs: matches the last sample", springDurationMs(config), dense[dense.length - 1].t);
  ok(
    "springDurationMs: critical damping settles faster than bouncy",
    springDurationMs({ from: 0, to: 1, damping: 26 }) < springDurationMs({ from: 0, to: 1, damping: 5 }),
  );
}

done();
