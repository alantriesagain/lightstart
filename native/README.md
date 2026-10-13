# @bootstrapp/light/native

Light compiled to a native binary with [scriptc](https://github.com/vercel-labs/scriptc), with no JavaScript engine inside: the signals, the html engine, the view core and the terminal host (`tdom/`). `native/index.js` is the entry; importing it installs the terminal host and light's signals as the effect adapter.

```
npm run typecheck:native   # tsc over the native graph against es2024, no dom lib
npm run coverage:native    # scriptc coverage native/index.js: fully static, nothing deferred
npm run test:native        # every native/*.test.js under node and under scriptc run; outputs must match
npm run probes             # the compiler probes (native/probes/) that decided how the core is written
node native/bench.js       # 10k keyed rows, update every 10th: node against the native binary
node native/demo.js        # a counter button, a scrolling list, an editor; --log <file> records what happens
native/pty.sh              # builds the demo natively and drives it in a pty: click, wheel, Tab, Enter, submit
light desktop run native/desktop/demo/backend.js   # the desktop shell's demo: a light page in the system web view (native/desktop/README.md)
```

## Which scriptc

Light's core is TypeScript (`html/`, `signals/`, `view/core.ts`, `tdom/`), and its classes keep `unknown`- and `object`-typed fields, which scriptc releases up to 0.3.0 refuse in TypeScript. Until a release carries that support, the native tools compile with a scriptc built from the fork branch that adds it (`ts-unknown-fields`), named by `SCRIPTC`:

```
SCRIPTC=/path/to/scriptc npm run verify
```

`native/scriptc.js` resolves the compiler for every tool: `$SCRIPTC`, else the scriptc in light's `node_modules`, else the one on `PATH`. `light desktop build` and `native/pty.sh` follow it too.

| File | What it owns |
|---|---|
| `index.js` | The entry: configures the terminal host and re-exports the html core, the signals, the view core and `tdom/` |
| `assert.js` | `ok`, `eq`, `eqn`, `throws`, `done`: the checks a native test uses, since node:test does not run under scriptc |
| `run.js`, `coverage.js` | The parity runner and the coverage gate `npm run verify` runs |
| `scriptc.js` | Which scriptc the native tools run (`$SCRIPTC` first) |
| `test-terminal.ts` | The test terminal the focus test renders on |
| `*.test.js` | Parts and views on the terminal host, layout and paint, wrapping and widths, the editor, the input decoder, the hit test and focus ring with a renderer on a test terminal |
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

A class from a JavaScript file pays bookkeeping on every field write once its instances reach an `unknown`, which was half of this benchmark's time; a TypeScript class does not (vercel-labs/scriptc#934). The last column removes one write, `oldParts[(oldIndex as number)] = null` in `html/parts.ts`: scriptc read its key as `number | undefined`, an unknown key, and treated every method in the program as replaceable, so each call went through a boxing wrapper. The index is narrowed now. What remains is mostly boxing: class instances wrapped to cross the engine's `unknown` boundaries (the host seam's nodes, template values) and released again, and the cycle collector.

With the core in JavaScript, the binary was an order of magnitude slower than V8 on this engine. `native/microbench.js` times the operations one by one, and probes p-n to p-s pin the cause: in scriptc 0.2.10 an instance of any class whose methods are called costs 1 to 4 µs to allocate, 0.35 µs per field write and about 0.5 µs per method call, while a class used as plain data costs what C does; a `Map` keyed by objects scales linearly with its size. A terminal screen holds hundreds of nodes, not ten thousand, so a frame still takes milliseconds; the gap is the compiler's to close, and `native/microbench.js` is the yardstick for each release.

The rules the shared code follows so that it compiles statically are in `probes/README.md`. The short form: values are `unknown` and are told apart by `typeof`, `instanceof` on module-level classes and `Array.isArray`; identity lives in classes, never in interfaces; a generic class never extends a generic class; a function-typed field never shares its name with a method; a callback handed to a library method annotates its parameters; no `any`.
