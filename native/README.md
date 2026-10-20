# @bootstrapp/light/native

Light compiled to a native binary with [scriptc](https://github.com/vercel-labs/scriptc), with no JavaScript engine inside: the signals, the html engine, the view core and the terminal host (`tdom/`). `native/index.js` is the entry; importing it installs the terminal host and light's signals as the effect adapter.

```
npm run typecheck:native   # tsc-ts over the native graph against es2024, no dom lib
npm run coverage:native    # scriptc coverage native/index.js: fully static, nothing deferred
npm run coverage:tasks     # the same over examples/tasks/main.js: no blocker, no slow path (its JSDoc JavaScript is not held to fully static)
npm run test:native        # every native/*.test.js under node and under scriptc run; outputs must match
npm run probes             # the compiler probes (native/probes/) that decided how the core is written
node native/bench.js       # 10k keyed rows, update every 10th: node against the native binary
node native/demo.js        # a counter button, a scrolling list, an editor; --log <file> records what happens
native/pty.sh              # builds the demo natively and drives it in a pty: click, wheel, Tab, Enter, submit
light desktop run native/desktop/demo/backend.js   # the desktop shell's demo: a light page in the system web view (native/desktop/README.md)
```

## Writing a native app

`examples/tasks` is the reference: light's three parts and two calls from the kit. Widecode is the next app to take this shape.

- **Models** (`models/*.js`): `defineModel(name, { field: T.type(options) })` over `T` from `@bootstrapp/light/types`. The row type is read off the model, `type Task = ModelRow<typeof tasks>` (`@bootstrapp/light/model`): a field declared `required: true` or given a default is on every stored row, the others are optional, and `id` is a string.
- **A controller** (`controllers/*.js`): `defineController({ name, props, sync, ...methods })` from `@bootstrapp/light/controller`, its rows bound to live queries of the models with `sync: { rows: { to: tasks, query, dependsOn } }`. The module registers the model binder first, `registerSyncBinder(modelBinder)` from `@bootstrapp/light/model/binder`, because `defineController` checks its `sync:` targets as the module loads; registering it again changes nothing. The logic lives here.
- **Views** (`views/*.ts`): `View` subclasses from `@bootstrapp/light/native`, in TypeScript because scriptc compiles a subclass of a TypeScript class reliably only when the subclass is TypeScript too. A view a template names by tag is `define("task-row", TaskRow)`, its attributes and `.prop=` bindings the `prop<T>(name, initial)` fields. An app's view calls the controller for the change it wants (`board.toggle(task.id, task.done)`); `$emit` is how a reusable component talks to a parent. An editor the app owns is a field, `readonly input = new TInput("textarea")`, placed with `${this.input}`; `find(node, test)` reaches any other element; `e.typed("d")` on a `KeyEvent` is a plain key.
- **The entry** (`main.js`): `openJsonl({ name, dir, io, models })` from `@bootstrapp/light/model/jsonl` opens the store over the models' JSONL files in `dir` through an `io` (the example's `lib/file-io.ts`, over `node:fs`) and makes it what every model call goes through; `await controller.$ready` waits for the first load; `runApp({ app, term, classes, onKey })` from `@bootstrapp/light/native` mounts the app's view on a renderer over the terminal, installs the baked classes, and hands every key to `onKey` first, Ctrl+C quitting when `onKey` did not take it.
- **The test** (`tasks.test.js`): the same `openJsonl` over an in-memory `io` and the same `runApp` over `native/test-terminal.ts`, keys pushed through the renderer's decoder and the checks reading the painted screen. It builds natively the same way and must print what it prints under node.
- **The classes**: the utility classes the views write are baked ahead of time into a table (`light classes:bake`), so the binary carries the table and not the classes engine; `verify` checks the table is current.

## Which scriptc

Light's core is TypeScript (`html/`, `signals/`, `view/core.ts`, `tdom/`, `controller/`, `model/`), and it needs eight scriptc patches no release carries yet (0.3.6 included): `unknown`- and `object`-typed fields in TypeScript classes, also through a generic instantiation (`Signal<unknown>`); methods of generic classes that a write can replace by name; keys asserted to be numbers (`slots[i as number]`) that leave method calls direct; coverage that reports slow paths; a JavaScript generic call whose return type does not map; `Promise.all` and array facts that widened every array; and an async function that returns a dynamic promise. Until a release has them, the native tools compile with the fork's `light-integration` branch (0.3.5 plus the patches), named by `SCRIPTC`; the fork's `FORK.md` lists every patch and how to re-apply them on a new scriptc release, and its `JSDOC.md` the issues JSDoc-typed JavaScript meets natively:

```
SCRIPTC=/path/to/scriptc npm run verify
```

`native/scriptc.js` resolves the compiler for every tool: `$SCRIPTC`, else the scriptc in light's `node_modules`, else the one on `PATH`. `light desktop build` and `native/pty.sh` follow it too.

The coverage gates run `--fail-on=slow-paths`: besides blockers, they fail on any write that makes methods replaceable (a computed key that can be any string, a reflective write), which would make every method call in the program dispatch dynamically and several times slower while the build still reports "fully static". The report names the write and how to avoid it.

| File | What it owns |
|---|---|
| `index.js` | The entry: configures the terminal host and re-exports the html core, the signals, the view core and `tdom/` |
| `app.ts` | `runApp`: a renderer over a terminal, the classes styler, the app's view mounted, its keys first, Ctrl+C quitting |
| `assert.js` | `ok`, `eq`, `eqn`, `throws`, `done`: the checks a native test uses, since node:test does not run under scriptc |
| `run.js`, `coverage.js` | The parity runner and the coverage gate `npm run verify` runs, over `native/index.js` and, with `--allow-dynamic`, the tasks app's entry |
| `scriptc.js` | Which scriptc the native tools run (`$SCRIPTC` first) |
| `test-terminal.ts` | The test terminal the focus test renders on |
| `elements-bench.js` | 1k rows as plain templates, as elements made by tag and as slotted rows: create, layout, update, reverse, clear, under node and natively |
| `*.test.js` | Parts and views on the terminal host, elements made by tag, slot projection, the theme's classes on elements and on the painted screen and through the focus states, layout and paint, wrapping and widths, the editor, the input decoder, the hit test and focus ring with a renderer on a test terminal |
| `demo.js`, `pty.sh` | The demo screen and the pty gate that clicks, scrolls, focuses and submits in it as a binary (3.3 MB stripped) |
| `probes/` | One-file programs that pin what the compiler accepts, and the decisions they produced (`probes/README.md`) |
| `desktop/` | The desktop shell: `DesktopApp` over the system web view, the page client, the C shim, `light desktop build|run`, the demo, the smoke and coverage gates |
| `tsconfig.json` | The native graph: what `typecheck:native` checks against `es2024` with node types |

Measured with `node native/bench.js` against the stripped binary on 2026-10-12, before and after the terminal tree's children became a linked list and its layout caches moved onto the node:

| Step | node, array | node, linked | native, array | native, linked |
|---|---|---|---|---|
| create 10k keyed rows | 313 ms | 64 ms | 8472 ms | 3289 ms |
| layout 10k rows | 84 ms | 41 ms | 1065 ms | 859 ms |
| update every 10th row | 22 ms | 9 ms | 237 ms | 183 ms |
| reverse 10k keyed rows | 1704 ms | 27 ms | 4563 ms | 542 ms |
| clear | 16 ms | 10 ms | 243 ms | 339 ms |

The quadratic sibling scan is gone on both. Natively a single insert got dearer (10k appends: 104 ms as an array, 288 ms linked), because every link is several field writes on an object the compiler keeps in its dynamic representation, where a write is a named lookup; that is why the 1k-row create is slower linked (232 ms to 352 ms) while 10k is 2.6 times faster. On the harness's screen the change is invisible: first frame 10 to 18 ms, 3 ms per keystroke, 5.8 MB resident.

Measured on 2026-10-13, medians of three, as the core moved from JavaScript to TypeScript (scriptc 0.2.10 for the first two native columns, the fork with the two fixes, on 0.3.1, for the third):

| Step | node | native, all JavaScript | native, terminal host in TypeScript | native, core in TypeScript | native, no method-replacing write |
|---|---|---|---|---|---|
| create 10k keyed rows | 72 ms | 3634 ms | 1459 ms | 611 ms | 90 ms |
| layout 10k rows | 41 ms | 948 ms | 23 ms | 19 ms | 12 ms |
| update every 10th row | 9 ms | 185 ms | 179 ms | 101 ms | 26 ms |
| reverse 10k keyed rows | 21 ms | 534 ms | 403 ms | 328 ms | 44 ms |
| clear | 11 ms | 384 ms | 160 ms | 66 ms | 21 ms |

Measured on 2026-10-17 with `node native/elements-bench.js` and its stripped binary (the fork's `light-integration` on 0.3.5), medians of three after a silent warm-up pass, 1k rows each way: plain keyed `<text>` rows, `<bench-row .row=${r}>` elements made by tag (`define`), and keyed rows slotted into a `<bench-card>`; the frame is flushed inside each timed step:

| Step (1k rows) | plain, node | plain, native | elements, node | elements, native | slotted, node | slotted, native |
|---|---|---|---|---|---|---|
| create | 5.1 ms | 4.6 ms | 8.6 ms | 19.8 ms | 6.9 ms | 5.2 ms |
| layout | 2.4 ms | 1.0 ms | 2.3 ms | 1.3 ms | 1.3 ms | 1.1 ms |
| update every 10th | 0.8 ms | 1.5 ms | 0.7 ms | 1.6 ms | 0.4 ms | 1.6 ms |
| reverse | 1.9 ms | 2.6 ms | 0.8 ms | 2.4 ms | 1.1 ms | 2.7 ms |
| clear | 1.3 ms | 1.4 ms | 1.5 ms | 2.5 ms | 1.0 ms | 1.6 ms |

An element made by tag costs about 20 µs to create natively, 4 times a plain row (a view, its box, a render into it), about 1 µs more than a plain row to re-render on a prop change (the 100 re-rendered elements add 0.1 ms) and 1 µs more to dispose; a slot costs nothing a row would not. A screen of 200 such elements builds in 4 ms, inside the first frame's budget, and a keystroke that changes one row costs the microseconds of that row.

A class from a JavaScript file pays bookkeeping on every field write once its instances reach an `unknown`, which was half of this benchmark's time; a TypeScript class does not (vercel-labs/scriptc#934). The last column removes one write, `oldParts[(oldIndex as number)] = null` in `html/parts.ts`: scriptc read its key as `number | undefined`, an unknown key, and treated every method in the program as replaceable, so each call went through a boxing wrapper. The index is narrowed now. What remains is mostly boxing: class instances wrapped to cross the engine's `unknown` boundaries (the host seam's nodes, template values) and released again, and the cycle collector.

With the core in JavaScript, the binary was an order of magnitude slower than V8 on this engine. `native/microbench.js` times the operations one by one, and probes p-n to p-s pin the cause: in scriptc 0.2.10 an instance of any class whose methods are called costs 1 to 4 µs to allocate, 0.35 µs per field write and about 0.5 µs per method call, while a class used as plain data costs what C does; a `Map` keyed by objects scales linearly with its size. A terminal screen holds hundreds of nodes, not ten thousand, so a frame still takes milliseconds; the gap is the compiler's to close, and `native/microbench.js` is the yardstick for each release.

The rules the shared code follows so that it compiles statically are in `probes/README.md`. The short form: values are `unknown` and are told apart by `typeof`, `instanceof` on module-level classes and `Array.isArray`; identity lives in classes, never in interfaces; a generic class never extends a generic class; a function-typed field never shares its name with a method; a callback handed to a library method annotates its parameters; no `any`; a `Map` holds class instances, never functions, so a tag's factory is a field of a `TagDefinition`; a `Signal<unknown>` is not a `Signal<T>`, so a declared prop is a `Prop<T>` wrapper over the unknown-typed signal; an empty array literal is typed where it is declared.
