# __TITLE__

A terminal app on [light](https://lightstart.dev): one model over a JSONL file, one controller with
live rows, and `View`s rendering into light's terminal host. It runs under node in development and
compiles to one native binary with [scriptc](https://github.com/vercel-labs/scriptc), with no
JavaScript engine inside.

## Start

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs `node src/main.ts`: the todos live in `.data/todos.jsonl`, and `--data <dir>` names
another folder, `--scheme light` the theme's light side (dark by default). Type a todo and press
Enter to add it; Tab moves the focus, Space toggles a todo, `d` deletes it, `f` cycles the filter,
`c` clears the done ones, Esc returns to the editor and Ctrl+C quits.

| Script | Runs |
|---|---|
| `dev` | `node src/main.ts` on the terminal |
| `test` | `node --test test/*.test.ts`: drives the app on light's test terminal |
| `bake` | `light classes:bake` into `src/classes.baked.ts`, the theme's utility classes for the binary |
| `build` | `scriptc build src/main.ts -o dist/__NAME__ --strip`: one native binary |
| `check` | `light check`: light's conventions over the sources |

`dev` needs an interactive terminal; the test does not. `bake` needs TypeScript, which is a
devDependency, and the test fails when the baked table is stale. `build` needs scriptc's native
compiler: `.npmrc` lets pnpm run its install script. With `ignore-scripts` on, run `pnpm rebuild
scriptc --config.ignore-scripts=false` once before `build`.

## Where things are

| Path | What |
|---|---|
| `src/main.ts` | The entry: opens the store, makes the controller, runs the app |
| `src/models/todos.ts` | The todo model (`defineModel` over `T`) and its row type |
| `src/controllers/todos.ts` | The filter, the live rows, the counts and the writes |
| `src/views/todo-app.ts` | The screen: the list, the editor, the footer and the app's keys |
| `src/views/todo-row.ts` | `<todo-row>`: one todo as a focusable line |
| `src/lib/file-io.ts` | The JSONL adapter's files through `node:fs` |
| `src/classes.baked.ts` | The class table `pnpm bake` writes; regenerate it when a class changes |
| `test/app.test.ts` | The app driven on a test terminal, the files in memory |
| `tsconfig.json` | The editor's settings; `types: ["node"]` is what `scriptc` reads node's APIs from |
| `.npmrc` | Lets pnpm run `scriptc`'s install script, which downloads its native compiler |

## Light

The packages are linked from a light checkout (`link:` with pnpm, `file:` with npm). A project
started with `--npm` names published versions instead. `AGENTS.md` has the conventions, and the
package READMEs in the checkout are the reference.
