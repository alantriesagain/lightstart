import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { createTween, createTimeline, createSpring } from "../tween.js";

{
  const tween = createTween({ from: 0, to: 10, ms: 100, easing: "linear" });
  eqn("createTween: starts at from", tween.value, 0);
  tween.step(50);
  eqn("createTween: interpolates halfway", tween.value, 5);
  eq("createTween: reports not done halfway", String(tween.done), "false");
  tween.step(50);
  eqn("createTween: ends at to", tween.value, 10);
  eq("createTween: reports done", String(tween.done), "true");
}

{
  const tween = createTween({ from: 0, to: 10, ms: 100, easing: "linear" });
  tween.step(1000);
  eqn("createTween: overshooting dt lands exactly on to", tween.value, 10);
}

{
  let updates = 0;
  const tween = createTween({ from: 0, to: 1, ms: 10, onUpdate: () => updates++ });
  tween.step(10);
  tween.step(10);
  tween.step(10);
  eqn("createTween: a finished tween ignores further steps", updates, 1);
}

{
  const tween = createTween({ from: 0, to: 10, ms: 100, delay: 50, easing: "linear" });
  tween.step(50);
  eqn("createTween: delay holds the start value", tween.value, 0);
  tween.step(50);
  eqn("createTween: delay then runs the duration", tween.value, 5);
  tween.step(50);
  eqn("createTween: delay then completes", tween.value, 10);
}

{
  const seen: number[] = [];
  const tween = createTween({ from: 2, to: 4, ms: 10, onComplete: (v) => seen.push(v) });
  tween.step(5);
  tween.step(5);
  tween.step(5);
  eq("createTween: onComplete fires exactly once, with the final value", JSON.stringify(seen), JSON.stringify([4]));
}

{
  const tween = createTween({ from: 0, to: 7, ms: 0 });
  tween.step(0);
  eqn("createTween: zero duration completes on the first step", tween.value, 7);
  eq("createTween: zero duration is done", String(tween.done), "true");
}

{
  const tween = createTween({ from: 0, to: 10, ms: 100, easing: "linear" });
  tween.step(50);
  tween.cancel();
  tween.step(50);
  eqn("createTween: cancel stops updates", tween.value, 5);
  eq("createTween: cancel reports done", String(tween.done), "true");
}

{
  const tween = createTween({ from: 1, to: 2, ms: 10 });
  tween.step(10);
  tween.reset();
  eqn("createTween: reset returns it to the start", tween.value, 1);
  eq("createTween: reset clears done", String(tween.done), "false");
  eqn("createTween: reset clears elapsed", tween.elapsed, 0);
}

{
  const eased = createTween({ from: 0, to: 1, ms: 100, easing: "easeInOut" });
  const linear = createTween({ from: 0, to: 1, ms: 100, easing: "linear" });
  eased.step(25);
  linear.step(25);
  ok("createTween: easing shapes the curve", eased.value < linear.value);
  eased.step(75);
  eqn("createTween: easing does not move the endpoint", eased.value, 1);
}

{
  const a = createTween({ from: 0, to: 1, ms: 100, easing: "linear" });
  const b = createTween({ from: 0, to: 1, ms: 100, easing: "linear" });
  const timeline = createTimeline().add(a).add(b, 100);

  timeline.step(50);
  eqn("createTimeline: first entry starts at its offset", a.value, 0.5);
  eqn("createTimeline: later entry has not started", b.value, 0);

  timeline.step(50);
  eqn("createTimeline: first entry completes", a.value, 1);
  eqn("createTimeline: later entry waits", b.value, 0);

  timeline.step(50);
  eqn("createTimeline: later entry runs at its offset", b.value, 0.5);
}

{
  const tween = createTween({ from: 0, to: 1, ms: 100, easing: "linear" });
  const timeline = createTimeline().add(tween, 100);
  timeline.step(150);
  eqn("createTimeline: an entry starting mid-step is credited the overshoot", tween.value, 0.5);
}

{
  const a = createTween({ from: 0, to: 1, ms: 50 });
  const b = createTween({ from: 0, to: 1, ms: 50 });
  const timeline = createTimeline().add(a).add(b, 100);
  timeline.step(50);
  eq("createTimeline: not done while an entry waits", String(timeline.done), "false");
  timeline.step(100);
  eq("createTimeline: done once every entry has run", String(timeline.done), "true");
}

{
  const tween = createTween({ from: 0, to: 1, ms: 50 });
  const timeline = createTimeline().add(tween);
  timeline.step(50);
  timeline.reset();
  eqn("createTimeline: reset rewinds the clock", timeline.elapsed, 0);
  eqn("createTimeline: reset rewinds every entry", tween.value, 0);
  eq("createTimeline: reset clears done", String(timeline.done), "false");
}

{
  const spring = createSpring({ value: 0, target: 1 });
  for (let i = 0; i < 200; i++) spring.step(16.67);
  ok("createSpring: converges on its target", Math.abs(spring.value - 1) < 0.01);
  ok("createSpring: comes to rest", spring.atRest);
}

{
  const spring = createSpring({ value: 0, target: 1 });
  for (let i = 0; i < 10; i++) spring.step(16.67);
  const midway = spring.value;
  ok("createSpring: mid-flight value is between the endpoints", midway > 0 && midway < 1);

  spring.setTarget(-1);
  for (let i = 0; i < 200; i++) spring.step(16.67);
  ok("createSpring: retargeting mid-flight chases the new goal", Math.abs(spring.value + 1) < 0.01);
}

{
  const spring = createSpring({ value: 0, target: 1 });
  spring.step(5000);
  ok("createSpring: a huge dt stays finite", Number.isFinite(spring.value));
  ok("createSpring: a huge dt still converges", Math.abs(spring.value - 1) < 0.01);
}

{
  const coarse = createSpring({ value: 0, target: 1 });
  const fine = createSpring({ value: 0, target: 1 });
  for (let i = 0; i < 10; i++) coarse.step(100);
  for (let i = 0; i < 100; i++) fine.step(10);
  ok("createSpring: sub-stepping makes the result dt-independent", Math.abs(coarse.value - fine.value) < 0.001);
}

{
  const spring = createSpring({ value: 0, target: 10 });
  spring.step(100);
  ok("createSpring: a moving spring has velocity", spring.velocity !== 0);
  spring.snap(3);
  eqn("createSpring: snap jumps to the value", spring.value, 3);
  eqn("createSpring: snap moves the target", spring.target, 3);
  eqn("createSpring: snap kills velocity", spring.velocity, 0);
  ok("createSpring: snap comes to rest", spring.atRest);
}

{
  const run = () => {
    const spring = createSpring({ value: 0, target: 1, damping: 12 });
    const out = [];
    for (let i = 0; i < 20; i++) out.push(spring.step(16.67));
    return out;
  };
  eq("createSpring: is deterministic", JSON.stringify(run()), JSON.stringify(run()));
}

{
  const tween = createTween({ from: 0, to: 10, ms: 100, easing: "linear" });
  const step = tween.step;
  eqn("a detached step still advances its tween", step(50), 5);
  eqn("and the tween reads the value", tween.value, 5);
  const spring = createSpring({ value: 0, target: 1 });
  const setTarget = spring.setTarget;
  ok("a detached spring method answers its spring", setTarget(2) === spring);
}

done();
