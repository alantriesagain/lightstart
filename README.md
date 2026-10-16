# light

Web components for the light DOM, written as plain objects. A component is a definition object with reactive properties and a `render()` that returns a tagged template; the engine turns it into a custom element. One package, no dependencies:

| Import | What it is |
|---|---|
| `@bootstrapp/light` | The view engine: `View`, `defineComponent`, `defineMixin`, `configureView` |
| `@bootstrapp/light/html` | The tagged-template renderer: `html`, `svg`, `render`, `key`, `element`, `nothing`, `unsafeHTML` ([README](html/README.md)) |
| `@bootstrapp/light/signals` | `signal`, `computed`, `effect`, `batch`, `untracked`, `selector` ([README](signals/README.md)) |
| `@bootstrapp/light/types` | `T`, the descriptors of a component's props, a controller's state and a model's fields |
| `@bootstrapp/light/controller` | Controllers: shared state, the `sync` binding, `resource()` ([README](controller/README.md)) |
| `@bootstrapp/light/model` | Models: schemas, a store over IndexedDB or any adapter, live queries ([README](model/README.md)) |
| `@bootstrapp/light/env` | The page's environment: viewport, breakpoint, OS, color scheme, `subscribe` |
| `@bootstrapp/light/navigation` | The host's router as components see it; plain anchors until one is configured |
| `@bootstrapp/light/theme` | Design tokens from a theme object, presets, `theme.css`, the color scheme, icons ([README](theme/README.md)) |
| `@bootstrapp/light/components/<category>/<name>.js` | The component library: `lc-*` tags in nine categories, their stylesheets, mixins, libs and stores ([README](components/README.md)) |

## A component

```js
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";

View.define("my-counter", { count: 0, label: "Count" }, (el) => html`
  <button @click=${() => el.count++}>${el.label}: ${el.count}</button>
`);
```

`<my-counter label="Clicks"></my-counter>` now renders and updates on every click.

`View.define(tag, props, render)` builds the class and registers the tag: the props beside the tag, then the render as a function of the element. A component with methods, hooks, events or mixins passes a definition object in the render's place, and `this` inside its methods is the element:

```js
View.define("my-menu", { open: false }, {
  mixins: [withEscapeKey],
  close() { this.open = false; },
  render() { return html`...${this.open}`; },
});
```

`View.define(tag, definition)` and `View.define(definition)` take a definition that carries its own `props` (and, in the second form, its `tag`); a function in the definition's place is its `render`. Every form types what it hands you: `el` in a render function and `this` in a method see the declared props, the mixins' props and members, the engine's members and a typed `$emit` from the `events` block, and a method sees the sibling methods too. Reading a name the component does not declare is a type error, except on a component that `extends` a tag: its base is known only by that tag, so other members read as `unknown`. The call answers the class; a component that `extends` a tag not yet defined is registered once that tag is, so a page may define its components in any order, and the call answers a promise of the class instead. Defining a tag again with the same definition is a no-op; with another definition it throws, and so does a definition still spelling the props block `properties`.

A module that exports a component for a loader to register (a Bootstrapp app autoloads `views/*.js`) wraps it in `defineComponent`, which returns the same object and types `this` the same way: a bare `export default { ... }` types `this` as the literal itself. `View.createClass(tag, definition)` builds without registering, and refuses a function in the definition's place.

## Props

A `props` entry is a default, and its type is read off the value: `count: 0` is a number, `label: "Count"` a string, `open: false` a boolean, `items: []` an array, an object an object, a function a function, `null` anything. Strings, numbers and booleans read and reflect their attribute; arrays, objects and functions do not.

An entry that needs an option is a descriptor built by `T` (`import T from "@bootstrapp/light/types"`). Each factory takes an options object or a bare default (`T.string("hi")` is `T.string({ defaultValue: "hi" })`). A descriptor is any object with `$type`, which is what `T.*` returns, so an object default is the one value that cannot carry that key.

| Factory | Value | Reads its attribute |
|---|---|---|
| `T.string()` | string | yes |
| `T.number()` | number | yes |
| `T.boolean()` | boolean (an empty attribute is `true`) | yes |
| `T.any()` | anything | yes |
| `T.array()` | array, parsed from JSON | no |
| `T.object()` | object, parsed from JSON | no |
| `T.function()` | function | no |

| Option | Meaning |
|---|---|
| `defaultValue` | The starting value. An object or array default is shared by every instance. |
| `attribute` | Whether the property reads and reflects its attribute. |
| `reactive: false` | A plain instance field: no store signal, no attribute, no update when it changes. |
| `getter()`, `setter(value)` | Computed or intercepted access. |
| `hasChanged(next, previous)` | Custom change detection. |

Any other option rides along on the descriptor for a plugin to read. A multi-word property reads its kebab-cased attribute: `useSystemPreference` is set by `<x use-system-preference>`.

## Updates

A property change calls `$requestUpdate()`, which queues the element. The queue drains once per animation frame, parents before children; an element a render dirties during the pass (a child whose props its parent just set, one the render just inserted) updates in the same pass, so a tree finishes in the frame that started it. Each update runs `willUpdate`, `render()`, then `firstUpdated` and `updated`. A property set in `willUpdate` belongs to the update in progress; one set later is recorded for the next frame. A render that throws is reported through `reportError` and the element keeps updating. An element that left the document skips its update until it connects again. `$requestUpdate()` answers a promise that settles once the update has run.

| Hook | When |
|---|---|
| `connected()` | The element entered the document |
| `disconnected()` | The element left it |
| `willUpdate({ changedProps })` | Before each render |
| `firstUpdated({ changedProps })` | After the first render |
| `updated({ changedProps })` | After every render |

Hooks are definition keys: the engine calls them with `this` bound to the element, and they never land on the instance.

## The element's members

Everything the engine installs on the element starts with `$`: `$state` (the reactive store), `$emit`, `$on`, `$off`, `$own`, `$requestUpdate`, `$hasUpdated`, `$` and `$$`. A definition may not declare a `$`-prefixed property or member, redefine a base member, or name a method after a DOM method (`remove`, `click`, `focus`, ...); `View.define` throws. Every plain name is free.

```js
this.$on("click", handler);              // listen
this.$on("button#click", handler);       // delegated: selector#event
this.$off("click", handler);
this.$emit("change", { value });         // a CustomEvent with detail
this.$own(unsubscribe);                  // runs at disconnect
this.$("input");                         // querySelector
this.$$("li");                           // querySelectorAll
```

## Mixins

Shared behaviour is a definition fragment, declared with `defineMixin` and listed under `mixins`:

```js
const withEscapeKey = defineMixin({
  props: { closeOnEscape: true },
  connected() {
    const onKey = (event) => event.key === "Escape" && this.closeOnEscape && this.close();
    document.addEventListener("keydown", onKey);
    this.$own(() => document.removeEventListener("keydown", onKey));
  },
});

View.define("my-menu", { open: false }, {
  mixins: [withEscapeKey],
  close() { this.open = false; },
  render() { ... },
});
```

Fragments merge in order, then the component's own keys: props, events and members union, the component wins a collision, lifecycle hooks chain mixin-first. A fragment may list `mixins` of its own, and a whole component definition may be listed as one. A fragment that takes options is a function returning a `defineMixin`.

## Slots

Components render into the light DOM. A `<slot>` or `<slot name="x">` in the template projects the host's children; the slot stays in the tree as their container (`display: contents`), carries `data-assigned` while anything is assigned and shows its fallback otherwise. `slot.children` is the assigned list, and the slot dispatches a non-bubbling `slotchange` when it changes. A parent's bindings inside slotted content keep updating after projection. Content naming a slot the current render lacks waits in a hidden `<unslotted>` element and moves in when that slot renders. A part is named by its tag (`part="my-card-body"`) and styled as `[part~=my-card-body]`; there is no shadow DOM, so `::part()`, `::slotted()` and `:host` match nothing.

## Prerendered pages

A page served with the components' markup sets `window.__PRERENDERED__ = true`. While it is set, a component whose first update finds children adopts that markup instead of rendering over it: its bindings anchor to the served DOM and the first real state change commits through them. A region the first render cannot adopt keeps the served content until `settle()` (see below) resolves. A host that projected its children is adopted through its slots, in any slot order; one whose dynamic children landed in two different slots renders fresh. The two-stage adoption is described in [html/README.md](html/README.md).

## Plugins

`View.use(plugin)` reaches every class built after it; registering a name again replaces the earlier plugin.

```js
View.use({
  name: "my-plugin",
  keys: ["flavor"],
  hooks: ["ripened"],
  props: (props, definition) => props,
  test: ({ component, definition }) => true,
  init: ({ View, component, definition, tag }) => {},
  events: { connected(detail) {}, updated(detail) {} },
});
```

| Field | Meaning |
|---|---|
| `keys` | Definition keys the plugin reads. They never land on the element. |
| `hooks` | Lifecycle hooks the plugin adds. They chain across mixins and `extends` and run through `$runHook(name, detail)`. |
| `props` | Rewrites a class's merged property declarations when the class is built. |
| `test` | Keeps the plugin's `events` and `init` off classes it answers false for. |
| `init` | Runs once per class, when it is defined. |
| `events` | Called on each instance's lifecycle, before the definition's own hooks. |

## Controllers

`@bootstrapp/light/controller` is shared app state for a page: a controller is a named piece of state and the methods that change it, one per name, built the first time anything reaches it and reset by `dispose()`. Its props are the same shorthand a component's are; its `sync` block binds them to storage, to another controller or to a store; a component binds its own props to the same targets once the page has `View.use(syncPlugin)`.

```js
import { defineController, nameControllers, registerAdapter } from "@bootstrapp/light/controller";
import { localStorage } from "@bootstrapp/light/controller/storage";

registerAdapter("local", localStorage);

export const cart = defineController({
  name: "cart",
  props: { items: /** @type {string[]} */ ([]), currency: "EUR" },
  sync: { currency: "local" },
  add(/** @type {string} */ id) { this.items = [...this.items, id]; },
});
nameControllers([cart]);
```

Each piece is its own entry and loads only what it uses: `/controller` (definitions and the sync registry), `/controller/resource` (`resource()`), `/controller/storage`, `/controller/document` and `/controller/url` (the adapters), `/controller/view` (the component plugin). Nothing else in light imports any of them. The reference is [controller/README.md](controller/README.md).

## Models

`@bootstrapp/light/model` is the data layer: a schema per model, written with `T`; a store that runs every write the same way (hooks, defaults, validation, file uploads, then the adapter, then `model:changed`) over any storage adapter; a model's api with eleven methods, declared once with `defineModel` and imported where it is used; relationships loaded one level deep. A page keeps its rows in IndexedDB and binds components and controllers to live queries:

```js
import T from "@bootstrapp/light/types";
import { configureModel, defineModel, modelBus } from "@bootstrapp/light/model";
import { createStore, storeRequest } from "@bootstrapp/light/model/store";
import { createAdapter, registerStorageAdapter } from "@bootstrapp/light/model/adapter";
import IndexedDBAdapter from "@bootstrapp/light/model/indexeddb";

export const todos = defineModel("todos", { title: T.string({ required: true }), done: T.boolean({ index: true, defaultValue: false }) });

registerStorageAdapter("indexeddb", IndexedDBAdapter);
const models = { todos: todos.schema };
const db = createAdapter("indexeddb", { name: "todos", version: 1, models, isDefaultAdapter: true });
await db.init();
const store = createStore({ models, databases: { indexeddb: db }, emit: (event, data) => modelBus().emit(event, data) });
configureModel({ request: storeRequest(store) });
// a component: open: T.array({ defaultValue: [], sync: todos, query: { where: { done: false } } })
```

A model's api talks to the store through the request `configureModel` sets, so a host can keep the store elsewhere (Bootstrapp runs it in a db-worker) and the page loads `/model` alone, without the store or the adapters. Binding a property to a model takes `registerSyncBinder(modelBinder)` from `/model/binder`. The reference is [model/README.md](model/README.md).

## The host

A component library needs a few things from the page it runs on. Light holds them as small modules with working defaults, and a host that has more (a router, translations, a settle tracker) hands its own in once.

- **`env`** (`@bootstrapp/light/env`): `width`, `height`, `breakpoint`, `isMobile`, `os`, `isTouch`, `prefersDark`, `dark` and `subscribe(fn)`, one debounced listener for the page.
- **`navigation`** (`@bootstrapp/light/navigation`): `href(path)`, `go(path)`, `click(event)`, `path()`, `subscribe(fn)`. Without a router a link is a plain anchor; `configureNavigation({ href, go, click, path, subscribe })` plugs one in.
- **`translate(key, params)`**: the host's text for a key, or `undefined`, so a component falls back to its own words. Set through `configureView({ translate })`.
- **`trackWork(promise, label)`**: hands async work a component waits on to the host's `wrap`, so a host that waits for a quiet page counts it.
- **`configureView({ track, wrap, settle, translate, dev })`**: `track(label)` is called when an update is scheduled and answers a function to call once it ran; `wrap(promise, label)` receives every async hook, plugin init and tracked work; `settle()` resolves when served content the client cannot adopt may be rendered over; `dev` turns on diagnostics. All optional; a page that uses none of them needs no call.
- **Theme** (`@bootstrapp/light/theme`): `applyTheme(theme)` writes the tokens a stylesheet reads, `presets.js` lists the themes light ships, `color-scheme.js` keeps the `dark` class and the reader's choice, and `icons.js` says where an icon comes from (`configureIcons({ load: iconify("lucide") })`; nothing is fetched until a page says so).

## The repository

This repository is the package: `pnpm install` once, `pnpm test` runs the node tests and then `light test` over the browser ones, `pnpm verify` runs the lint, the typecheck, `light check` and the tests, and passes only at zero errors. `components/` is the component library, `locales/` the words it draws, `examples/` whole pages built on light alone (`npx light serve` serves the repository with the core's TypeScript stripped as it goes out; open `/examples/…`), and `website/` the catalogue site (a Bootstrapp app, left out of the published package). The Bootstrapp monorepo consumes this repository in place: its `light/` is a symlink to a checkout beside it, and its `projects/light` one to `website/`.

## Testing

Tests are written against `node:test` and `node:assert/strict`. One that needs no DOM runs under `node --test`; one that does runs in a real browser with `npx light test <files...>`, where the same two specifiers resolve to light's browser implementation of them ([test/README.md](test/README.md)).

## Checking

`npx light check [dir]` reads every component definition in a project and holds it to light's conventions: a definition goes through `defineComponent`, a property is declared under `props`, a boolean binds as `?attr`, a part is named by its tag, a hook has the engine's name, a method does not shadow a DOM method, a stylesheet scopes through the component's tag. A definition is a module's default export, or any `View.define(...)` call on light's default import, in its five shapes and several per file; a page's `<script type="module">` blocks are read as its JavaScript, at the page's own lines. A tag the parser cannot read (an expression rather than a string) is not a component. Every `defineController(...)` call is read the same way and held to the controller's conventions (`controller/README.md`). Templates are read as trees, so a rule sees elements, their attributes with the binding kind (`?attr`, `@event`, `.prop`, or a plain attribute), their text and their nesting, each at its offset in the file; a template nested in an expression is a tree of its own. The project is the nearest directory up from `dir` with a `package.json` (or `--root <dir>`); a `dir` inside it narrows the pass to that directory and reads it as a directory of components. The rules are light's own (`check/rules/`, ids `light/<name>`) and the project's `check/rules/`; `--rule <id>` runs one, `--json` prints the result, the exit code is 1 at any error. Reading a definition takes the TypeScript compiler, so the project installs it (`npm i -D typescript`). Inside a Bootstrapp app the same rules run through `bootstrapp check`, discovered from `node_modules/@bootstrapp/light`.

## Linting

`@bootstrapp/light/eslint` is an eslint plugin. `light/check-errors` and `light/check-warnings` are `light check` inside eslint: the findings of the file being linted, at their line and column with the checker's rule id after the message, so an eslint editor extension shows them as you type (an unsaved buffer stands in for the file). `light/no-non-jsdoc-comments` and `light/no-explicit-any-jsdoc` hold the code style light is written in. `@bootstrapp/light/eslint/recommended.js` is that style as one flat config, the plugin's rules with the core, stylistic and `eslint-plugin-lit` rules it goes with; it needs `eslint`, `@stylistic/eslint-plugin`, `eslint-plugin-lit` and `globals` installed, all optional peers of light. This repository lints itself with it (`eslint.config.js`).

```js
import recommended from "@bootstrapp/light/eslint/recommended.js";

export default [recommended];
```

## Hosts

One engine, three hosts. The renderer and the view core never touch a document: a host (`html/host.js`) answers for nodes, attributes, listeners, template cloning and frames. `@bootstrapp/light` and `@bootstrapp/light/html` install the browser host (`dom/`); `@bootstrapp/light/markup` renders on an in-memory tree and serializes markup a page adopts, which also makes it the host the engine's conformance suite runs on under plain node; `@bootstrapp/light/native` installs the terminal host (`tdom/`), a node tree with its own layout, painter, screen diff, input decoder, editor, mouse and focus, and compiles with [scriptc](https://github.com/vercel-labs/scriptc) to a static binary with no JavaScript engine in it. A component on the terminal is a `View` with signal fields and a `render()` that returns an `html` template; the HTML tag names map onto the terminal's box, text, span and input. `native/README.md` has the gates, the benchmark and the compiler's rules. `@bootstrapp/light/native/desktop` is the desktop shell on top of that: the app's backend compiled by scriptc, its UI a light page in the operating system's web view, the two joined by a typed bridge; `native/desktop/README.md`.

## Files

| File | What it owns |
|---|---|
| `view/index.js` | The browser entry: `View`, `defineComponent`, `defineMixin`, `configureView` |
| `view/core.js` | `ViewCore`, the host-neutral update cycle and queue every host's `View` forwards to; `configureView`, `trackWork`, `translate` |
| `view/definition.js` | Definition composition: mixins, hook chaining, the define-time key guard |
| `dom/view.js` | The browser `View`: the custom element, the property system, attributes, slots, plugins, `View.define`, `View.register` |
| `dom/host.js` | The browser host of the renderer (`DomHost`); `dom/` holds everything that needs a document |
| `markup/` | The renderer on an in-memory tree: server prerendering a page adopts, and the host every other host is measured against |
| `tdom/` | The terminal host: a node tree, layout, paint, a screen diff, key input, an editor, and `View` on it |
| `native/` | Light as a native binary: the scriptc entry, the parity tests, the coverage gate, the compiler probes |
| `native/desktop/` | The desktop shell: a native backend, a web view, a typed bridge; the shim over webview, the build tool, the demo and its gates |
| `env/`, `navigation/` | The page's environment and the host's router, as components read them |
| `controller/` | Controllers, the sync binding and its registries, the storage, document and hash adapters, `resource()`, the component sync plugin |
| `model/` | Models: `defineModel` and the api, the store and its write pipeline, the storage SPI, the IndexedDB adapter, the binding of a property to a live query |
| `theme/` | Tokens, presets, `theme.css`, the color scheme, icons |
| `components/` | The component library, one directory per category, a `.css` and a `.demo.js` beside each component |
| `locales/` | The words the components draw, keyed by tag, one file per language |
| `test/` | `node:test` and `node:assert` for the browser, the runner page, the loop and `light test` |
| `eslint/` | The eslint plugin: the checker as two rules, the two style rules, the recommended config |
| `check/` | The convention checker: the rule contract, the parsers of a definition and its templates, the project context, the engine, `light check`, and light's own rules under `check/rules/` |
| `html/` | The renderer; `html/core.js` is the engine without a host, `html/host.js` the seam a host implements |
| `signals/index.js` | The signals |
| `signals/store.js` | The keyed reactive store behind `$state` |
| `types/` | `T`: descriptors, attribute and row parsing, validation, relationships, timestamps and files |

## License

MIT
