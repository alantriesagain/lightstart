# @bootstrapp/light/html

light's tagged-template renderer. Same `html`` `` authoring and
`TemplateStringsArray` cache contract as lit-html, plus the three things lit
can't do: **two-stage adoption** of browser-prerendered DOM, **thunk bindings**
(`${() => ...}`) for fine-grained updates, and the `key()` / `element()`
primitives that replaced lit's directives. 9.1 KB min+gzip bundled with esbuild, zero dependencies.

| File | What it owns |
|---|---|
| `index.js` | The whole public API: `html`, `svg`, `render`, `nothing`, `unsafeHTML`, `key`, `element`, `configure`, `disposeTree` |
| `host.js` | The `Host` seam: what the engine asks of a renderer (prepare/clone templates, nodes, attributes, listeners, frames); `dom/host.js` is the browser host |
| `core.js` | The DOM-free entry a native build imports; `index.js` adds the DOM host, adoption and slots |
| `values.js` | The value classes a template holds: `TemplateResult`, `Keyed`, `ElementSpec`, `Unsafe`, and the `html`/`svg`/`key`/`element`/`unsafeHTML` factories |
| `parser.js` | Quasi state machine → markup + parts list (binding positions, error cases) |
| `template.js` | Template prep, WeakMap identity cache, instance cloning |
| `parts.js` | Part classes, commit semantics, keyed reconciliation, `render()` |
| `reactive.js` | Thunk ↔ effect-adapter seam (`configure({ effect, host })`) |
| `../dom/adopt.js` | Two-stage adoption of browser-prerendered DOM, installed into the engine through `installAdoption` |
| `../dom/slots.js` | Light-DOM `<slot>` projection: unit walkers, `SlotPart`, `projectSlots`, the `<unslotted>` holder |

Tests are the spec: `html.browser.test.js` (semantics), `parity.browser.test.js`
(locked against real lit-html), `adopt.browser.test.js` (adoption incl. the minify
round-trip). Benchmarks: `benchmarks/` in this package (renderer, thunks,
view and lit-html pages).

Two-stage adoption in one paragraph: prerendered pages carry the renderer's
own `$`/`/` part markers (roots use `$r`/`/r`); on a `__PRERENDERED__` page a
component's first render **binds**: parts anchor to the baked DOM, listeners
attach, attribute baselines seed from the DOM, child content stays untouched;
and the first real state change **commits** through the anchored parts, so
matching data no-ops and drift updates only what changed. The split exists
because "first render" and "data ready" are independent events and first
render always wins the race; a naive adopt-on-first-render would reconcile
baked content down to the empty pre-data state. A render before the data is
ready is not a state change either: a resource's pending flag flipping draws
the same spinner again, a list still empty draws its empty state again. With
`RenderOptions.settle` (a view passes the `settle()` its host configured) a value the
served range cannot adopt is held until the app is idle; whatever matches
before then adopts, and a region still drifted at settle renders fresh.

## The render-once pattern

`examples/grand-octave/` is the living demo (with the lit
original beside it for comparison; both show a `render() ×N` counter).
Every dynamic binding is a thunk over a signal, so `render()` runs once at
connect and stays at ×1 while you play; the lit version's counter climbs
with every note. What the comparison actually teaches: **DOM writes are
identical in both** (lit's attribute parts dedupe commits just like ours);
the difference is the road, not the destination. lit re-executes the whole
template and re-diffs every binding per update, one scheduled microtask
later; a thunk commits directly into its own part, synchronously with the
event that caused it. Invisible at one small component; it is the
update-every-10th benchmark row at scale. Two things the pattern needs:
`configure({ effect })` must be wired; the view engine does it when it
loads (importing `@bootstrapp/light` is enough; the effect comes from
`@bootstrapp/light/signals`), so any page using View gets live thunks
for free. A standalone page rendering without View must call
`configure({ effect })` itself, or thunks silently evaluate once and
never update. Templates rendered per list item should be
cached per item (`row.view ??= tpl(row)`) so re-renders keep thunk
identities stable instead of churning effect subscriptions.

## Seams deliberately left unbuilt

Design decisions made with full context (Aug 2026, the lit-replacement
branch) and parked until a real consumer exists. If you're about to build one
of these, the thinking is done; start here.

### Stale-content indicator (`data-pending`)

Solid 2.0's `isPending` marks stale-but-visible async content for styling.
Our stage-1-adopted parts are exactly that state, but **the renderer must not
expose it**: the renderer cannot distinguish "data-driven, stage 2 coming"
from "static, this content is final": a renderer-level attribute would mark
every static prerendered component pending *forever*, and CSS keyed to it
would dim finished content. Pending is knowledge only the app layer has.

When a design wants stale styling, implement it in the **view layer's
dataQuery plugin** (~10 lines, zero renderer changes): on connect, if the
component adopted prerendered DOM and has an unresolved query →
`setAttribute("data-pending", "")`; remove it on `dataLoaded` (or the first
store write). Components without dataQuery set/clear it themselves. Then
`[data-pending] .card { opacity: .7 }` gives the Solid affordance, truthfully
scoped to components that actually have data in flight.

### Single-marker child parts (create fast-path)

We insert two comments per dynamic child (`<!--$--><!--/-->`); lit inserts
one. That is most of our 7–17% deficit on bulk creates: explicit ranges are what let the match walk
find part content in serialized HTML with a balanced scan. A single-marker
mode for non-adopting contexts was considered and rejected as speculative;
revisit only if create-time shows up in a real profile, and never at the cost
of the pair in prerendered output.

### Async in the graph (promise thunks)

Solid 2.0 made async a property of the reactive graph (async memos,
`<Loading>`, stale-while-revalidate). Our equivalent seam is `reactive.js`: a
thunk returning a Promise could hold its last committed value while the new
one is in flight (mini-`Loading` semantics per part, no component API). Parked
because adoption already covers the dominant async moment (page load) and
nothing in the apps needs per-binding async yet. If built: resolve in the
effect, keep `part.committed` until the promise settles, and only then
commit; never clear to empty mid-flight (the same never-show-the-empty-
middle-state principle adoption implements).
