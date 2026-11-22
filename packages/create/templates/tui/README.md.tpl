# __TITLE__

A terminal app on [light](https://lightstart.dev): a todo model over JSONL files, a todos controller with live rows, and views that render into the terminal. The folders are the app; light writes the wiring into `.light/`, and the host opens the store, starts the controller, makes the root view and runs it with the baked class table. `scriptc` compiles it to one native binary with no JavaScript engine inside.

## Start

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs `light run --`: a dev build, fast when nothing changed, run in the current folder. `pnpm dev -- --flag` passes flags to the app: pnpm drops its own `--` and appends the rest, so they land after `light run`'s `--`, which hands them to the app. The todos live in `.data/` in the current folder by default, `--data <dir>` names another, and `--scheme light` picks the theme's light side (dark by default). Type a todo and press Enter; Tab moves the focus, Space toggles a todo, `d` removes it, Esc returns to the editor and Ctrl+C quits. `light build` makes the release binary at `dist/__NAME__`.

| Script | Runs |
|---|---|
| `dev` | `light run --`: a dev build with scriptc, fast when nothing changed, and run the app; `pnpm dev -- --flag` passes flags to the app |
| `test` | `light test`: the app on light's test terminal, under node and natively, the outputs equal |
| `build` | `light build`: the release binary at `dist/__NAME__` |
| `check` | `light check`: light's native conventions over the sources |
| `lint` | `light lint`: eslint with the project's config |
| `typecheck` | `light typecheck`: the prepare steps, then `tsc --noEmit` |
| `verify` | `light verify`: check, lint, typecheck and test in order |

Run `pnpm verify` before committing.

`dev` needs an interactive terminal; the test does not. `test` and `build` need scriptc's native compiler: `.npmrc` lets pnpm run its install script. With `ignore-scripts` on, run `pnpm rebuild scriptc --config.ignore-scripts=false` once before `build`.

## Where things are

| Path | What |
|---|---|
| `src/app.ts` | The app's name and terminal host |
| `src/models/todo.ts` | The todo model and its row type |
| `src/controllers/todos.ts` | The live rows and the writes |
| `src/views/app-root.ts` | The root view: the list, the editor and the keys |
| `src/views/todo-row.ts` | `<todo-row>`: one todo as a focusable line |
| `.light/` | Generated wiring and the baked class table: never edit, never commit |
| `test/app.test.ts` | The app driven on a test terminal |

## Light

The packages are linked from a light checkout (`link:` with pnpm, `file:` with npm). A project started with `--npm` names published versions instead. [AGENTS.md](AGENTS.md) has the conventions; `@lightstart/app`'s README and the other package READMEs in the checkout are the reference.
