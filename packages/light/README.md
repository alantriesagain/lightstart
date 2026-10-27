# light

`@bootstrapp/light` is a small runtime for light-DOM web components. A component
can be a class with signal fields, or a definition object with reactive props;
both become standard custom elements. The package has no dependencies and runs
in browsers, under server-side prerendering, and on native targets.

| Import | What it provides |
|---|---|
| `@bootstrapp/light` | The view engine: `View`, `View.define`, `defineComponent`, `defineMixin`, `configureView` |
| `@bootstrapp/light/html` | The tagged-template renderer: `html`, `svg`, `render`, `key`, `element`, `nothing`, `unsafeHTML` ([README](html/README.md)) |
| `@bootstrapp/light/signals` | `signal`, `computed`, `effect`, `batch`, `untracked`, `selector` ([README](signals/README.md)) |
| `@bootstrapp/light/types` | `T`, the descriptors used for a component's props, a controller's state and a model's fields |
| `@bootstrapp/light/controller` | Controllers: shared state, the `sync` binding, `resource()` ([README](controller/README.md)) |
| `@bootstrapp/light/model` | Models: schemas, a store over IndexedDB or another adapter, live queries ([README](model/README.md)) |
| `@bootstrapp/light/env` | The page environment: viewport, breakpoint, OS, color scheme, `subscribe` |
| `@bootstrapp/light/navigation` | The host's router as components see it; plain anchors until one is configured |
| `@bootstrapp/light/theme` | Design tokens from a theme object, presets, `theme.css`, the color scheme, icons ([README](theme/README.md)) |
| `@bootstrapp/light/theme/classes` | The utility classes a theme provides: `createEngine`, `buildTheme`, the rule table ([README](theme/README.md#classes)) |
| `@bootstrapp/light/components/<category>/<name>.js` | The component library: `lc-*` tags in nine categories ([README](components/README.md)) |

## Two ways to write a component

A definition object describes the props and a render function. The props are
reactive, and their types are inferred from the defaults:

```js
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";

View.define("my-counter", { count: 0, label: "Count" }, (el) => html`
  <button @click=${() => el.count++}>
    ${el.label}: ${el.count}
  </button>
`);
```

A class extends `View` and holds state in signal fields. Its `render()` is
tracked, so any signal the render reads re-renders the element when it changes:

```js
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
import { signal } from "@bootstrapp/light/signals";

class MyCounter extends View {
  count = signal(0);

  render() {
    return html`
      <button @click=${() => this.count.value++}>
        Count: ${this.count.value}
      </button>
    `;
  }
}

View.register("my-counter", MyCounter);
```

Both examples register the `<my-counter>` element. A class adds methods and
lifecycle hooks directly (`connected()`, `updated()`, and so on). A definition
passes methods, hooks, events and mixins in the object instead, and `this`
inside them is the element:

```js
View.define("my-menu", { open: false }, {
  mixins: [withEscapeKey],
  close() { this.open = false; },
  render() {
    return html`
      <div>${this.open}</div>
    `;
  },
});
```

`View.define` accepts three shapes:

- `View.define(tag, props, render)`
- `View.define(tag, definition)`
- `View.define(definition)`, when the definition carries its own `tag`

A function in a definition's place is its render. `View.createClass(tag,
definition)` builds a class without registering it. `defineComponent(definition)`
is an identity wrapper for a module whose default export a loader registers; it
preserves `this` typing.

Every definition form types `this`, `el`, the declared props, mixins and `$emit`
from the `events` block. Reading an undeclared member is a type error, except on
a component that `extends` a tag, where the base is known only by its tag. A
class written by hand types its signal fields and methods directly.

A definition that `extends` a tag not yet defined registers when that tag is,
and `View.define` returns a promise of the class. `View.define` treats the same
tag with the same definition as a no-op and throws for a different definition.

## Props

A `props` entry is a default. Its type is read from the value: `count: 0` is a
number, `label: ""` a string, `open: false` a boolean, `items: []` an array, and
`null` accepts anything. Strings, numbers and booleans read and reflect their
attribute; arrays, objects and functions do not.

A prop that needs an option uses a descriptor from `T`
(`import T from "@bootstrapp/light/types"`). Each factory takes an options
object or a bare default, so `T.string("hi")` is the same as
`T.string({ defaultValue: "hi" })`.

| Factory | Value | Reads its attribute |
|---|---|---|
| `T.string()` | string | yes |
| `T.number()` | number | yes |
| `T.boolean()` | boolean; an empty attribute is `true` | yes |
| `T.any()` | anything | yes |
| `T.array()` | array, parsed from JSON | no |
| `T.object()` | object, parsed from JSON | no |
| `T.function()` | function | no |

| Option | Meaning |
|---|---|
| `defaultValue` | The starting value. Object and array defaults are shared by every instance. |
| `attribute` | Whether the property reads and reflects its attribute. |
| `reactive: false` | A plain instance field: no signal, no attribute, no update when it changes. |
| `getter()`, `setter(value)` | Computed or intercepted access. |
| `hasChanged(next, previous)` | Custom change detection. |

Any other option stays on the descriptor for a plugin to read. A multi-word
property reads its kebab-cased attribute, so `useSystemPreference` is set by
`<x use-system-preference>`.

## Updates and lifecycle

A property or signal change schedules an update. The queue drains once per
animation frame, parents before children. A child dirtied during the pass (for
example, by a prop its parent just set) updates in the same pass. An element
that leaves the document skips updates until it reconnects.

Each update runs `willUpdate`, then `render()`, then `firstUpdated` and
`updated`. A property set in `willUpdate` belongs to the current update; one set
later is recorded for the next frame. A render that throws is reported through
`reportError`, and the element keeps updating. `$requestUpdate()` returns a
promise that settles once the update has run.

| Hook | When |
|---|---|
| `connected()` | The element entered the document |
| `disconnected()` | The element left the document |
| `willUpdate({ changedProps })` | Before each render |
| `firstUpdated({ changedProps })` | After the first render |
| `updated({ changedProps })` | After every render |

In a class, hooks are methods. In a definition, they are definition keys. In
both forms the engine calls them with `this` bound to the element, and they do
not land on the instance.

## Element members

Everything the engine installs on an element starts with `$`:

```js
this.$on("click", handler);              // listen
this.$on("button#click", handler);       // delegated: selector#event
this.$off("click", handler);
this.$emit("change", { value });         // a CustomEvent with detail
this.$own(unsubscribe);                  // runs at disconnect
this.$("input");                         // querySelector
this.$$("li");                           // querySelectorAll
```

The installed members are `$state`, `$emit`, `$on`, `$off`, `$own`,
`$requestUpdate`, `$hasUpdated`, `$` and `$$`.

A definition may not declare a `$`-prefixed member, redefine a base member, or
name a method after a DOM method such as `remove`, `click` or `focus`.
`View.define` throws for each of these. Any other member name is available.

## Mixins

Shared behavior is a definition fragment created with `defineMixin` and listed
under `mixins`:

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
  render() {
    return html`
      <div>${this.open}</div>
    `;
  },
});
```

Fragments merge in order, followed by the component's own keys. Props, events
and members are unioned, the component wins a collision, and lifecycle hooks
run mixin-first. A fragment may list its own `mixins`, and a whole component
definition may be used as a fragment. A fragment that takes options is a
function returning a `defineMixin`.

## Slots

Components render into the light DOM. A `<slot>` or `<slot name="x">` in the
template projects the host's children. The slot remains in the tree as their
container (`display: contents`), carries `data-assigned` while anything is
assigned, and shows its fallback otherwise. `slot.children` is the assigned
list, and the slot dispatches a non-bubbling `slotchange` when it changes.
Parent bindings inside slotted content keep updating after projection. Content
that names a slot the current render lacks waits in a hidden `<unslotted>`
element and moves in when that slot renders.

A part is named by its tag (`part="my-card-body"`) and styled as
`[part~=my-card-body]`. There is no shadow DOM, so `::part()`, `::slotted()` and
`:host` match nothing.

## Prerendered pages

A page served with the components' markup sets `window.__PRERENDERED__ = true`.
While it is set, a component whose first update finds children adopts that
markup instead of rendering over it: its bindings anchor to the served DOM, and
the first real state change commits through them. A region the first render
cannot adopt keeps the served content until `settle()` resolves. A host that
projected its children is adopted through its slots, in any slot order; one
whose dynamic children landed in different slots renders fresh. The two-stage
adoption is described in [html/README.md](html/README.md).

## Plugins

`View.use(plugin)` applies to every class built after the call. Registering a
plugin with the same name replaces the earlier one.

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
| `keys` | Definition keys the plugin reads. They do not land on the element. |
| `hooks` | Lifecycle hooks the plugin adds. They chain across mixins and `extends` and run through `$runHook(name, detail)`. |
| `props` | Rewrites a class's merged property declarations when the class is built. |
| `test` | Keeps the plugin's `events` and `init` off classes it answers `false` for. |
| `init` | Runs once per class, when it is defined. |
| `events` | Called on each instance's lifecycle, before the definition's own hooks. |

## Controllers

`@bootstrapp/light/controller` holds shared app state. A controller is a named
piece of state and the methods that change it, created the first time anything
reaches it and reset by `dispose()`. Its props use the same shorthand as a
component's. Its `sync` block binds props to storage, another controller or a
store. A component can bind its own props to the same targets after the page
calls `View.use(syncPlugin)`.

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

Each piece is a separate entry that loads only what it uses: `/controller`,
`/controller/resource`, `/controller/storage`, `/controller/document`,
`/controller/url` and `/controller/view`. Nothing else in light imports them.
See [controller/README.md](controller/README.md).

## Models

`@bootstrapp/light/model` is the data layer. A model has a schema written with
`T` and an api created by `defineModel`. A store applies every write the same
way (hooks, defaults, validation, file uploads, the adapter, then
`model:changed`) over any storage adapter. A page can keep rows in IndexedDB
and bind components and controllers to live queries:

```js
import T from "@bootstrapp/light/types";
import { configureModel, defineModel, modelBus } from "@bootstrapp/light/model";
import { createStore, storeRequest } from "@bootstrapp/light/model/store";
import { createAdapter, registerStorageAdapter } from "@bootstrapp/light/model/adapter";
import IndexedDBAdapter from "@bootstrapp/light/model/indexeddb";

export const todos = defineModel("todos", {
  title: T.string({ required: true }),
  done: T.boolean({ index: true, defaultValue: false }),
});

registerStorageAdapter("indexeddb", IndexedDBAdapter);
const models = { todos: todos.schema };
const db = createAdapter("indexeddb", {
  name: "todos",
  version: 1,
  models,
  isDefaultAdapter: true,
});
await db.init();
const store = createStore({
  models,
  databases: { indexeddb: db },
  emit: (event, data) => modelBus().emit(event, data),
});
configureModel({ request: storeRequest(store) });
```

A model's api talks to the store through the request that `configureModel` sets,
so a host can keep the store elsewhere. Binding a property to a model uses
`registerSyncBinder(modelBinder)` from `/model/binder`. See
[model/README.md](model/README.md).

## The host

Light needs a few things from the page it runs on. Each has a working default,
and a host with more (a router, translations, a settle tracker) provides its own
once.

- **`env`** (`@bootstrapp/light/env`): `width`, `height`, `breakpoint`,
  `isMobile`, `os`, `isTouch`, `prefersDark`, `dark` and `subscribe(fn)`.
- **`navigation`** (`@bootstrapp/light/navigation`): `href(path)`, `go(path)`,
  `click(event)`, `path()`, `subscribe(fn)`. Without a router, a link is a plain
  anchor; `configureNavigation({ href, go, click, path, subscribe })` plugs one
  in.
- **`translate(key, params)`**: the host's text for a key, or `undefined` so a
  component falls back to its own words. Set through `configureView({ translate })`.
- **`trackWork(promise, label)`**: hands async work to the host's `wrap`, so a
  host that waits for a quiet page counts it.
- **`configureView({ track, wrap, settle, translate, dev })`**: `track(label)`
  runs when an update is scheduled and returns a function to call once it has
  run; `wrap(promise, label)` receives every async hook, plugin init and tracked
  work; `settle()` resolves when served content the client cannot adopt may be
  rendered over; `dev` turns on diagnostics.
- **Theme** (`@bootstrapp/light/theme`): `applyTheme(theme)` writes the tokens a
  stylesheet reads; `presets.js` lists the shipped themes; `color-scheme.js`
  keeps the `dark` class and the reader's choice; `icons.js` says where an icon
  comes from (`configureIcons({ load: iconify("lucide") })`; nothing is fetched
  until a page asks).

## Testing, checking and linting

Tests use `node:test` and `node:assert/strict`. A test that needs no DOM runs
under `node --test`; one that does runs in a real browser with
`npx light test <files...>`. The same specifiers resolve to light's browser
implementation there. See [test/README.md](test/README.md).

`npx light check [dir]` checks component definitions against light's
conventions: definitions go through `defineComponent`, props are declared under
`props`, boolean attributes bind as `?attr`, parts are named by their tag, hooks
use the engine's names, methods do not shadow DOM methods, and stylesheets scope
through the component's tag. It reads templates as trees, including `<script
type="module">` blocks in pages. Findings are reported at their file, line and
column; `--rule <id>` runs one rule and `--json` prints the result.

`@bootstrapp/light/eslint` provides `light/check-errors` and
`light/check-warnings` inside ESLint, plus the style rules light uses.
`@bootstrapp/light/eslint/recommended.js` combines them into one flat config:

```js
import recommended from "@bootstrapp/light/eslint/recommended.js";

export default [recommended];
```

## Hosts

The renderer and view core do not touch a document. A host (`html/host.js`)
provides nodes, attributes, listeners, template cloning and frames.

- **Browser** (`@bootstrapp/light` and `@bootstrapp/light/html`): installs the
  browser host from `dom/`.
- **Markup** (`@bootstrapp/light/markup`): renders on an in-memory tree and
  serializes markup a page adopts. It is also the host for the engine's
  conformance suite under plain Node.
- **Terminal** (`@bootstrapp/light/native/tui`): installs a node tree with its
  own layout, painter, screen diff, input decoder, editor, mouse and focus. It
  compiles with [scriptc](https://github.com/vercel-labs/scriptc) to a static
  binary with no JavaScript engine. A terminal component is a `View` with signal
  fields and a `render()` returning an `html` template; HTML tag names map onto
  the terminal's box, text, span and input. See
  [native/tui/README.md](native/tui/README.md).
- **Desktop** (`@bootstrapp/light/native/desktop`): a native backend compiled
  by scriptc, a UI served as a light page in the operating system's web view,
  and a typed bridge between them. See
  [native/desktop/README.md](native/desktop/README.md).

On the terminal, `define(tag, Class)` names a view for templates, as
`customElements.define` names a component for a page. Its `prop` fields take
attributes and `.prop=` bindings, `$emit` sends an event a parent handles with
`@`, and children written inside the tag project into its `<slot>`s. The theme's
utility classes work there too, through
`configureClasses(new TerminalClasses(theme, scheme))`.

## Repository

The package is `packages/light` in the light repository. The root README has the
layout and the gates. Run `pnpm install` once at the repository root. In this
folder, `pnpm test` runs the node tests and then the browser tests, and
`pnpm verify` runs the package's typechecks, `light check`, the tests and the
native gates. Both pass only at zero errors.

| Path | Owns |
|---|---|
| `view/` | The browser entry, the host-neutral update cycle, definition composition |
| `dom/` | The browser `View`, the DOM host, prerender adoption, light-DOM slots |
| `html/`, `signals/`, `types/` | The renderer, the reactive primitives, the `T` descriptors |
| `markup/`, `native/` | The in-memory host and the native targets |
| `controller/`, `model/` | Shared state and the data layer |
| `theme/` | Tokens, presets, color scheme, icons and the utility-class engine |
| `components/`, `locales/` | The component library and its translated words |
| `check/`, `eslint/`, `test/` | The convention checker, the ESLint plugin and the test runner |

## License

MIT
