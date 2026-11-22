# Working in __TITLE__

A terminal app on `@lightstart/app`: the folders are the app, and light writes the wiring. `src/app.ts` names the host, the models, controllers and views live in their folders, and `light` generates `.light/app.ts` and `.light/main.ts`. The terminal host opens the stores (JSONL files by default), starts the controllers and the routes, makes the root view and runs it with the baked class table.

## The folders

| Path | Holds |
|---|---|
| `src/app.ts` | `defineApp({ name, host: "tui", theme?, stores?, root?, args? })`: `stores` by name (`main` is JSONL files under `--data` unless it names another adapter or folder, `at`), `args` from argv beside the host's `--data`, `--scheme` and `--route` |
| `src/models/<name>.ts` | One model, default-exported; the file name is the model's name |
| `src/seed.ts` | Optional: rows by model name (`{ note: [{ text: "…" }] }`), added once into an empty store before the controllers start; `src/seed.dev.ts` holds demo rows `light build` leaves out |
| `src/controllers/<name>.ts` | One controller, default-exported; the file name is its name |
| `src/views/<tag>.ts` | One view; the file name is its tag, and the root view default-exports its class |
| `src/routes.ts` | Optional: `{ "/path": { view: "<tag>", name?, title? } }`, drawn by `<app-container>` in the root view; `navigate(path)` from `@lightstart/app/tui` goes to a path |
| `src/modes/<name>.ts` | Optional: exports `main(argv)` before the host when argv has `--<name>`, and may export `matches(argv)` |
| `test/` | Tests that drive the app on light's `TestTerminal` |
| `tsconfig.json` | The editor's settings and the options `scriptc` compiles with |

A view reaches its controller with an import, `import todos from "../controllers/todos.ts"`. A controller imports its models the same way, `import todo from "../models/todo.ts"`. One controller follows another's state by name with `sync:` (the file name is the name), and imports it to call its methods: the run starts an imported controller first.

## Generated files

`.light/app.ts`, `.light/main.ts` and `.light/classes.baked.ts` are written by `light app` (and by the `prepare` step before a build, a run, a test or a typecheck). Never edit them and never commit them: `.light/` is in `.gitignore` beside `dist/` and `.data/`.

The class table comes from the generation. A theme class in a template must be a literal, a ternary or an alternation of literals; a class composed at run time is not baked.

## A model and a controller

`defineModel` reads `T` descriptors. Hold the schema in a `const schema: ModelSchema`: the generation writes a row class for it into `.light/models.ts`, one typed field per schema field, and its `static of` checks a row once on read, so a damaged row is skipped and warned about. A controller is a `Controller` subclass, default-exported as one instance; `liveRows(this, model, () => query, Row.of)` follows a model's rows from the controller's start, its first load counted before the controller is ready.

```ts
import { Controller } from "@lightstart/light/controller/class";
import { liveRows } from "@lightstart/light/model/binder";
import todo from "../models/todo.ts";
import { TodoRow } from "../../.light/models.ts";

class Todos extends Controller {
  readonly rows = liveRows<TodoRow>(this, todo, () => ({ order: "addedAt" }), TodoRow.of);
  constructor() { super("todos"); }
  async add(title: string) { await todo.add({ title, addedAt: Date.now() }); }
}

export default new Todos();
```

## A view

A view is a `View` subclass from `@lightstart/light/native/tui` whose `render()` returns an `html` template. The root view default-exports its class and may handle keys in `onKey(renderer, e)`. Another view registers its tag with `View.register(tag, Class)`, the same name a web view uses, and takes props with `this.prop<T>(name, initial)`.

```ts
import { html, View } from "@lightstart/light/native/tui";
import todos from "../controllers/todos.ts";
import type { KeyEvent } from "@lightstart/light/native/tui";
import type { TodoRow } from "../../.light/models.ts";

class TodoRowView extends View {
  todo = this.prop<TodoRow | null>("todo", null);
  render() {
    const todo = this.todo.value;
    return todo === null ? null : html`<p @click=${() => todos.toggle(todo)}>${todo.title}</p>`;
  }
}

View.register("todo-row", TodoRowView);
```

## Writing a piece

Write a model, a controller or a view from the app's folder, in TypeScript and with the shape the scaffold uses:

```bash
light new model note2 --fields "title:string,done:boolean"
light new controller notes2 --model note2
light new view note-list
```

A field is `name:type`, types are `string`, `boolean`, `number`, `array` and `object`, and a `!` after the type makes it required (`title:string!`); a `?`, or nothing, is optional with a default (`""`, `false`, `0`, `[]`, `{}`). The commands refuse a file that already exists, and a view tag needs a hyphen.

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | `light run --`: a dev build with scriptc, fast when nothing changed, and runs the app; `pnpm dev -- --flag` passes flags to the app, `--data <dir>` names the data folder and `--scheme light` the theme's light side |
| `pnpm test` | `light test`: drives the app on a test terminal, under node and natively, the outputs equal; `--node-only` for node alone |
| `pnpm build` | `light build`: the release binary at `dist/__NAME__` |
| `pnpm check` | `light check`: light's native conventions over the sources |
| `pnpm lint` | `light lint`: eslint with the project's config |
| `pnpm typecheck` | `light typecheck`: the prepare steps, then `tsc --noEmit` |
| `pnpm verify` | `light verify`: check, lint, typecheck and test in order |

Run `pnpm verify` before committing.

`dev` needs an interactive terminal; the test does not. `test` and `build` need scriptc's native compiler: `.npmrc` lets pnpm run its install script.

## Rules that matter here

- TypeScript with erasable syntax only: no enums, namespaces, parameter properties or decorators. The sources run under node and compile with scriptc.
- No `any`. Data from outside is `unknown`, narrowed with `typeof`, `instanceof` or `Array.isArray`.
- Imports between the app's own files name the `.ts` file; imports of light name its subpath.

## Read more

| What | Where |
|---|---|
| The app layer: `defineApp`, the folders, the generated wiring, the terminal host, the test helper | `@lightstart/app`'s README |
| The terminal host: the tree, layout, views, `runApp`, the test terminal | `@lightstart/light/native/tui`'s README |
| Models, queries, the JSONL adapter and the binder | `@lightstart/light/model` |
| Controllers, sync, resources and adapters | `@lightstart/light/controller` |
| The engine: views, `html`, signals, props, the theme | `@lightstart/light`'s README |

## Routes and tests

`src/routes.ts` maps paths to view tags on the terminal too: the root view writes `<app-container>`, `navigate(path)` from `@lightstart/app/tui` goes to another, and a path's parameters (`/notes/:id`) arrive as the view's props (`this.prop<string>("id", "")`). `--route <path>` starts the app at a path.

A test opens the app with `openApp(manifest, { args })` from `@lightstart/app/test` (stores in memory) and draws it with `mountApp(manifest, opened, { cols, rows })` from `@lightstart/app/tui/test`: push keys with `mounted.renderer.decoder.pushText(text)`, then `await mounted.settle()` and read `mounted.text()`. Tests run under node and natively with the same output, so they print through `@lightstart/test/assert.ts` (`ok`, `eq`, `done`).
