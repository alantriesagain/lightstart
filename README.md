# light

A small runtime for light-DOM web components. A component is a definition object
with reactive props, or a class with signal fields; both become standard custom
elements. A tagged-template renderer, signals, typed props, controllers, models,
a theme engine and a library of 132 components sit on top, and the same code runs
in a browser, in server-side prerendering and natively through
[scriptc](https://github.com/vercel-labs/scriptc) — the terminal target compiles
to a static binary with no JavaScript engine inside.

No runtime dependencies, no virtual DOM. Components render into the light DOM,
so a page's stylesheet and a theme reach them as they reach any other element.

## Install

```bash
npm i @bootstrapp/light
```

```js
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";

View.define("my-counter", { count: 0 }, (el) => html`
  <button @click=${() => el.count++}>Count: ${el.count}</button>
`);
```

That registers `<my-counter>`. The same component as a class holds its state in
signals, and `render()` re-runs when one it reads changes:

```js
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
import { signal } from "@bootstrapp/light/signals";

class MyCounter extends View {
  count = signal(0);
  render() {
    return html`<button @click=${() => this.count.value++}>
      Count: ${this.count.value}
    </button>`;
  }
}

View.register("my-counter", MyCounter);
```

## Documentation

The catalogue at [lightstart.dev](https://lightstart.dev) renders every component
from its own demo, in any skin.

| Read | For |
|---|---|
| [The package](packages/light/README.md) | Components, props, lifecycle, mixins, slots, plugins, hosts, the API of every module |
| [The renderer](packages/light/html/README.md) | `html`, `svg`, `render`, `key`, `element`, `nothing`, `unsafeHTML` |
| [Signals](packages/light/signals/README.md) | `signal`, `computed`, `effect`, `batch`, `untracked`, `selector` |
| [Controllers](packages/light/controller/README.md) | Shared state, `sync` bindings, `resource()` |
| [Models](packages/light/model/README.md) | Schemas, the store, IndexedDB and JSONL adapters, live queries |
| [The theme](packages/light/theme/README.md) | Tokens, presets, color scheme, icons, the utility-class engine |
| [The component library](packages/light/components/README.md) | The `lc-*` tags, their CSS, forms, theming and composition |
| [Native targets](packages/light/native/README.md) | The terminal and desktop hosts, scriptc, the coverage and parity gates |
| [Testing and checking](packages/light/test/README.md) | `light test`, `light check`, the ESLint plugin |

## Repository

| Folder | Holds |
|---|---|
| `packages/light/` | `@bootstrapp/light`: the runtime and the `light` command, with [its documentation](packages/light/README.md) |
| `packages/native/`, `packages/tui/` | The workspace packages native apps share, and `light-native`, their tooling ([README](packages/README.md)) |
| `examples/` | Pages and apps on light alone: `starter`, `todomvc`, `indexeddb-explorer`, `grand-octave`, the five guided pages (`01-basic-counter.html` … `05-plugin-system.html`), and `tasks`, the terminal reference app ([README](examples/tasks/README.md)) |
| `benchmarks/` | The view engine and renderer under node, natively and in Chromium ([README](benchmarks/README.md)) |
| `website/` | The catalogue site, a Bootstrapp app |

## Develop

`pnpm install` once at the root.

```bash
pnpm verify      # every gate: lint, types, light check, node and browser tests, native parity and coverage
pnpm test        # the package's tests
pnpm check       # light check over the repository and the package
pnpm bench       # the benchmarks in Chromium
npx light serve  # serve the repository; open /examples/…
```

`pnpm verify` passes only at zero errors; beyond the package's gates it covers
the tasks app's coverage and baked classes and the workspace packages' checks.

The Bootstrapp monorepo consumes this repository in place: its `light/` is a
symlink to a checkout beside it, its workspace lists `light/packages/light`, and
its `projects/light` links to `website/`.

## License

MIT
