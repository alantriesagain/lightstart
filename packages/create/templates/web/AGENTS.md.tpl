# Working in __TITLE__

A web app on `@lightstart/app`: the folders are the app, and light writes the wiring. `src/app.ts` names the few choices, the models, controllers and views live in their folders, and `src/routes.ts` maps paths to view tags. `light` generates `.light/app.ts` and `.light/main.ts`; `index.html` loads `.light/main.ts`.

## The folders

| Path | Holds |
|---|---|
| `src/app.ts` | `defineApp({ name, host: "web", theme?, stores?, root?, args? })`: `stores` by name (`main` is IndexedDB unless it names another kind, `{ cache: { kind: "memory" } }` beside it), `args` read from the URL query |
| `src/models/<name>.ts` | One model, default-exported; the file name is the model's name |
| `src/controllers/<name>.ts` | One controller, default-exported; the file name is its name |
| `src/views/<tag>.ts` | One view, registering its tag; the file name is the tag |
| `src/routes.ts` | Optional: `{ "/path": { view: "<tag>", name?, title? } }` |
| `src/styles.css` | The generated components' stylesheet, then the app's own rules |
| `test/` | Browser tests, run by `light test` |

A view reaches its controller with an import, `import notes from "../controllers/notes.ts"`. A controller imports its models the same way, `import note from "../models/note.ts"`. One controller reaches another by name with `sync:` (the file name is the name), never by importing its instance.

## Generated files

`.light/app.ts`, `.light/main.ts` and the manifest are written by `light app` (and by `serve`, `build` and `test` before they start). Never edit them, and never commit them: `.light/` is in `.gitignore` beside `.deployed/`.

The app layer opens the stores (a model picks one with its schema's `$adapter`, `main` when it names none), names and starts the controllers, applies the theme, builds the router from `src/routes.ts` and mounts the root view. It also writes `.light/components.ts` and `.light/components.css` for a project on `@lightstart/components`: the views write `lc-*` tags and the generation defines them and imports their stylesheets, so a view imports no component and calls no `View.define`.

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | `light serve --watch`: the app on the first free port from 3000, reloading on a change |
| `pnpm build` | `light build`: bundles into `.deployed/builds/<id>` and points `.deployed/current` at it |
| `pnpm test` | `light test test/*.test.ts`: the browser tests in headless Chromium (`pnpm exec playwright install chromium` once) |
| `pnpm check` | `light check`: light's conventions over the sources |

The dev server builds the page's importmap from `package.json`; the build resolves bare specifiers through `node_modules`. Never write an importmap in `index.html`.

## A view

A view is a `View` subclass whose `render()` returns an `html` template. Reading a signal in `render()` subscribes the view to it.

```ts
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import notes from "../controllers/notes.ts";

class Counter extends View {
  render() {
    return html`<button @click=${() => notes.add("one")}>${notes.rows.value.length}</button>`;
  }
}

View.register("my-counter", Counter);
```

## Read more

| What | Where |
|---|---|
| The app layer: `defineApp`, the folders, the generated wiring, the web host, the test helper | `@lightstart/app`'s README |
| Views, `html`, signals, props, models, controllers, the theme | `@lightstart/light`'s README |
| Every `lc-*` tag, its props and its stylesheet | `@lightstart/components`'s README |
| `light serve`, `light build`, `light test`, `light check` | `@lightstart/dev`, `@lightstart/build`, `@lightstart/cli` |
