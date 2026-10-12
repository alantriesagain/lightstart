# @bootstrapp/light/dom

The browser host of the renderer: everything in light that needs a document.

| File | What it owns |
|---|---|
| `host.js` | `DomHost`: templates through `<template>` + `innerHTML`, cloning with `importNode` and a TreeWalker, DOM nodes, attributes, properties, listeners, animation-frame flushes |
| `adopt.js` | Two-stage adoption of prerendered markup: the structural match walk, marker pairs, child-root skipping, and the `resolvePending`/`adoptPart`/`rootPart` hooks it installs into the engine |
| `slots.js` | Light-DOM `<slot>` projection: unit walkers, `SlotPart`, `projectSlots`, the `<unslotted>` holder |
| `types.ts` | `SlotHost`, `ProjectHooks`, `ProjectedUnit` |

`@bootstrapp/light/html` installs the DOM host when it loads; `@bootstrapp/light/html/core` is the same engine without it, for hosts that are not a browser.
