# @bootstrapp/light/dom

The browser host of the renderer: everything in light that needs a document.

| File | What it owns |
|---|---|
| `index.js` | The browser host in one import: `View`, the definition wrappers, `configureView`, `DomHost` |
| `view.js` | The browser `View`: a custom element that carries the update cycle of `ViewCore` (`view/core.js`) on its own prototype. The class declares the cycle's methods as calls into the core so it has their types, then takes the core's functions themselves in their place, so an update costs no extra call; `$own` stays the element's, since it also takes a list. `View.define` builds a class from a definition, `View.register` installs one written by hand with signal fields and a tracked render |
| `host.js` | `DomHost`: templates through `<template>` + `innerHTML`, cloning with `importNode` and a TreeWalker, DOM nodes, attributes, properties, listeners, animation-frame flushes that fall back to a timeout while the page is hidden, `reportError` |
| `adopt.js` | Two-stage adoption of prerendered markup: the structural match walk, marker pairs, child-root skipping, and the `resolvePending`/`adoptPart`/`rootPart` hooks it installs into the engine |
| `slots.js` | Light-DOM `<slot>` projection: unit walkers, `SlotPart`, `projectSlots`, the `<unslotted>` holder |
| `types.ts` | `SlotHost`, `ProjectHooks`, `ProjectedUnit` |

`@bootstrapp/light/html` installs the DOM host when it loads; `@bootstrapp/light/html/core` is the same engine without it, for hosts that are not a browser.
