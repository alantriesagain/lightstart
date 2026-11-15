# Working in __TITLE__

A light web app: one page, light views in `src/views/`, and `lc-*` components from `@lightstart/components`. Light's packages are linked from a checkout, so their READMEs are the reference.

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | `light serve --watch`: the app on the first free port from 3000, reloading on a change |
| `pnpm build` | `light build`: bundles into `.deployed/builds/<id>` and points `.deployed/current` at it |
| `pnpm test` | `light test test/*.test.ts`: the browser tests in headless Chromium (`pnpm exec playwright install chromium` once) |
| `pnpm check` | `light check`: light's conventions over the sources |

The dev server builds the page's importmap from `package.json`; the build resolves bare specifiers through node's `node_modules`. Do not write an importmap in `index.html`.

## Where a view goes

| Path | What |
|---|---|
| `src/main.ts` | Entry: applies the theme, registers the `lc-*` components, imports the views |
| `src/views/` | One module per view; every module registers its tag |
| `src/styles.css` | Theme and component stylesheets, then the app's own rules |
| `test/` | Browser tests: `*.test.ts`, run by `light test` |

## A view

A view is a `View` subclass with signal fields; `render()` returns an `html` template. Reading a signal in `render()` subscribes the view to it.

```ts
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { signal } from "@lightstart/light/signals";

class Counter extends View {
  static props = { label: "Count" };
  count = signal(0);

  render() {
    return html`
      <button @click=${() => this.count.value++}>${this.label}: ${this.count.value}</button>
    `;
  }
}

View.register("my-counter", Counter);
```

A definition object works too: `View.define("my-counter", { count: 0 }, (el) => html`...`)`, with `el.count` a reactive prop. Declare prop types with `T` from `@lightstart/light/types` (`T.string()`, `T.number()`, `T.boolean()`, `T.array()`, `T.object()`, `T.function()`); a bare default (`count: 0`) reads its type from the value. Use `this.$emit(name, detail)` for events, `this.$on(...)`/`this.$own(...)` for listeners, and `this.$(selector)` to query the view's own tree.

Views render into the light DOM. A `<slot>` in the template projects the host's children, and a part is named by the tag (`part="my-counter-body"`), never by shadow DOM's `::part()` or `:host`.

## lc-* components

Import the component module, its stylesheet, and register it:

```ts
import card from "@lightstart/components/layout/card.js";
View.define(card);
```

```css
@import "../node_modules/@lightstart/components/layout/card.css";
```

Then write the tag: `<lc-card padding="lg">...</lc-card>`. A component that draws another needs that one registered too (`lc-button` extends `lc-link`; `lc-card` can draw `lc-button` and `lc-icon`). The catalogue in `@lightstart/components/README.md` lists every tag and what it renders. If an icon is asked for, `configureIcons({ load: iconify("lucide") })` from `@lightstart/light/theme/icons.js` says where it comes from; the theme comes from `applyTheme(await loadPreset("default"))` (`@lightstart/light/theme` and `@lightstart/light/theme/presets.js`).

## Tests

A test is written against `node:test` and `node:assert/strict`; `light test` runs it in Chromium, where those two specifiers resolve to light's implementations.

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "../src/main.ts";

describe("app-root", () => {
  it("counts", async () => {
    const root = document.createElement("app-root");
    document.body.append(root);
    await root.$requestUpdate();
    root.querySelector("button").click();
    await root.$requestUpdate();
    assert.ok((root.textContent ?? "").includes("Count: 1"));
    root.remove();
  });
});
```

`await el.$requestUpdate()` settles once the update queue has run.

## Read more

| Package | README |
|---|---|
| `@lightstart/light` | The engine, `View.define`, props, signals, the theme, controllers, models |
| `@lightstart/components` | Every `lc-*` tag, its mixins and its stylesheets |
| `@lightstart/dev` | `light serve`: the importmap, the shell, routes, extensions |
| `@lightstart/build` | `light build`: steps, output layout, extensions |
| `@lightstart/cli` | `light`: commands, hooks, routes, extensions |
| `@lightstart/light/test` | `light test`: the browser runner and what it supports |
