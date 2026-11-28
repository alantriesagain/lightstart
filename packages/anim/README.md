# @lightstart/anim

Animation primitives that never schedule themselves: easing curves, damped springs, and dt-driven tweens and timelines. Pure, node- and browser-safe, with no `requestAnimationFrame` of its own.

Two ways to move a value are kept apart. `spring.js` bakes motion ahead of time into a `{ t, value }` keyframe channel; `tween.js` integrates it live, stepped by whoever owns the clock. Both read the same curves, so a render and a game loop agree.

## API

| Export | What it does |
|---|---|
| `linear`, `easeIn`, `easeOut`, `easeInOut`, `easeInBack`, `easeOutBack`, `easeInOutBack`, `easeOutBounce`, `easeInBounce`, `easeOutElastic` | Easing functions, `(t: 0..1) => number` |
| `EASINGS`, `EASING_NAMES`, `ease(name, t)` | The registered curves, their names, and a lookup falling back to `easeInOut` |
| `cubicBezier(p1x, p1y, p2x, p2y)` | A CSS-style cubic-bezier timing function |
| `interpChannel(channel, t)` | Interpolate a keyframe channel at time `t` |
| `sampleSpring(config)` | Sample a damped spring into dense `{ t, value }` points |
| `simplifyChannel(points, tolerance)` | Drop points a straight line reproduces |
| `springChannel(config)` | A sampled and simplified spring channel |
| `springDurationMs(config)` | The settle time of a spring |
| `createTween(config)` | A one-shot interpolation with `step`, `cancel`, `reset` |
| `createTimeline()` | Ordered tweens on one clock |
| `createSpring(config)` | A spring integrated live, with a movable target |

The TypeScript shapes (`EasingFn`, `EasingName`, `KeyframePoint`, `SpringConfig`, `TweenConfig`, `Tween`, `Timeline`, `LiveSpringConfig`, `LiveSpring`) are in `types.ts`.

## Views

`views/drag-panel.js` defines `<anim-drag-panel>`, a bottom panel whose detents are ordinary lengths and whose drag is settled by a live spring. It is a light DOM component and needs `@lightstart/light` and `@lightstart/components`.

## Tests

```bash
light test @lightstart/anim
```

The three test files are plain scripts on `@lightstart/test/assert.ts`; the view's test is a browser test.
