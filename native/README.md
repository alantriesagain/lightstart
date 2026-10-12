# @bootstrapp/light/native

Light compiled to a native binary with [scriptc](https://github.com/vercel-labs/scriptc), with no JavaScript engine inside: the signals, the html engine, the view core and the terminal host (`tdom/`). `native/index.js` is the entry; importing it installs the terminal host and light's signals as the effect adapter.

```
npm run typecheck:native   # tsc over the native graph against es2024, no dom lib
npm run coverage:native    # scriptc coverage native/index.js: fully static, nothing deferred
npm run test:native        # every native/*.test.js under node and under scriptc run; outputs must match
npm run probes             # the compiler probes (native/probes/) that decided how the core is written
node native/bench.js       # 10k keyed rows, update every 10th: node against the native binary
```

| File | What it owns |
|---|---|
| `index.js` | The entry: configures the terminal host and re-exports the html core, the signals, the view core and `tdom/` |
| `assert.js` | `ok`, `eq`, `eqn`, `throws`, `done`: the checks a native test uses, since node:test does not run under scriptc |
| `run.js`, `coverage.js` | The parity runner and the coverage gate `npm run verify` runs |
| `*.test.js` | Parts and views on the terminal host, layout and paint, wrapping and widths, the editor, the input decoder |
| `probes/` | One-file programs that pin what the compiler accepts, and the decisions they produced (`probes/README.md`) |
| `tsconfig.json` | The native graph: what `typecheck:native` checks against `es2024` with node types |

Measured with `node native/bench.js` against the stripped binary (2.35 MB) on 2026-10-12:

| Step | node | native |
|---|---|---|
| create 10k keyed rows | 313 ms | 8472 ms |
| layout 10k rows | 84 ms | 1065 ms |
| update every 10th row | 22 ms | 237 ms |
| reverse 10k keyed rows | 1704 ms | 4563 ms |
| clear | 16 ms | 243 ms |

The binary is an order of magnitude slower than V8 on this engine today; `native/microbench.js` times the operations one by one to show where. A terminal screen holds hundreds of nodes, not ten thousand, so a frame still fits; the gap is the next thing to measure and narrow.

The rules the shared code follows so that it compiles statically are in `probes/README.md`. The short form: values are `unknown` and are told apart by `typeof`, `instanceof` on module-level classes and `Array.isArray`; identity lives in classes, never in interfaces; a generic class never extends a generic class; a function-typed field never shares its name with a method; a callback handed to a library method annotates its parameters; no `any`.
