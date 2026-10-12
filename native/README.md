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
```

| File | What it owns |
|---|---|
| `index.js` | The entry: configures the terminal host and re-exports the html core, the signals, the view core and `tdom/` |
| `assert.js` | `ok`, `eq`, `eqn`, `throws`, `done`: the checks a native test uses, since node:test does not run under scriptc |
| `run.js`, `coverage.js` | The parity runner and the coverage gate `npm run verify` runs |
| `*.test.js` | Parts and views on the terminal host, layout and paint, wrapping and widths, the editor, the input decoder, the hit test and focus ring with a renderer on a test terminal |
| `demo.js`, `pty.sh` | The demo screen and the pty gate that clicks, scrolls, focuses and submits in it as a binary (3.3 MB stripped) |
| `probes/` | One-file programs that pin what the compiler accepts, and the decisions they produced (`probes/README.md`) |
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

The binary is an order of magnitude slower than V8 on this engine today. `native/microbench.js` times the operations one by one, and probes p-n to p-s pin the cause: in scriptc 0.2.10 an instance of any class whose methods are called costs 1 to 4 µs to allocate, 0.35 µs per field write and about 0.5 µs per method call, while a class used as plain data costs what C does; a `Map` keyed by objects scales linearly with its size. A terminal screen holds hundreds of nodes, not ten thousand, so a frame still takes milliseconds; the gap is the compiler's to close, and `native/microbench.js` is the yardstick for each release.

The rules the shared code follows so that it compiles statically are in `probes/README.md`. The short form: values are `unknown` and are told apart by `typeof`, `instanceof` on module-level classes and `Array.isArray`; identity lives in classes, never in interfaces; a generic class never extends a generic class; a function-typed field never shares its name with a method; a callback handed to a library method annotates its parameters; no `any`.
