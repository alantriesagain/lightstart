# Working on @lightstart/anim

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The public surface: the runtime exports and the types |
| `easing.js` | Named easing curves |
| `channel.js` | Cubic-bezier timing and channel interpolation |
| `spring.js` | Springs sampled into baked keyframe channels |
| `tween.js` | Tweens, timelines and live springs, stepped by their owner |
| `types.ts` | The public TypeScript shapes and the runtime re-exports |
| `views/drag-panel.js` | `<anim-drag-panel>`, a generic bottom panel |

## Rules the sources keep

- Nothing here touches `requestAnimationFrame`, the DOM, or a host: a primitive is stepped by its owner with a delta in milliseconds.
- A spring is either baked (`spring.js`) or integrated live (`tween.js`), never both at once.
- JavaScript with JSDoc and a `types.ts`; no `any`.
- The views are the only browser code; the core stays node-safe.

## Gates

From the repository root:

```bash
light test @lightstart/anim
light typecheck @lightstart/anim
```

The three core tests are plain scripts on `@lightstart/test/assert.ts` and end with `done()`; `views/drag-panel.browser.test.js` runs in headless Chromium.
