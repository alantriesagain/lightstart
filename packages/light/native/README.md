# Light, native

Light compiled to a native binary with [scriptc](https://github.com/vercel-labs/scriptc), with no JavaScript engine inside. Each kind of native app is a target with a folder and an entry of its own:

| Target | Entry | What it is |
|---|---|---|
| `tui/` | `@lightstart/light/native/tui` | The terminal: the signals, the html engine and the view core on a terminal host, and `runApp` for an app (`tui/README.md`) |
| `desktop/` | `@lightstart/light/native/desktop` | The backend of a desktop app whose UI is a light page in the system web view (`desktop/README.md`) |

What every target shares sits here: which scriptc the tools run, the parity runner, the coverage gate and the report it reads, the checks a native test uses, and the compiler probes. Another kind of native app gets a folder beside these; the packages under `packages/` (`packages/README.md`) are what apps of a kind share.

```
npm run typecheck:native   # tsc-ts over the terminal graph (native/tui) against es2024, no dom lib
npm run coverage:native    # scriptc coverage native/tui/index.ts: fully static, nothing deferred
npm run coverage:tasks     # the same over examples/tasks/main.js: no blocker (its JSDoc JavaScript is not held to fully static)
npm run test:native        # every target's *.test.js under node and under scriptc run; outputs must match
npm run probes             # the compiler probes (native/probes/) that decided how the core is written
light desktop run native/desktop/demo/backend.js   # the desktop shell's demo: a light page in the system web view
```

## Which scriptc

Light's core is TypeScript (`html/`, `signals/`, `view/core.ts`, `native/tui/`, `controller/`, `model/`), and it compiles with the scriptc release its `package.json` pins (0.4.12), installed with the workspace's dependencies; it needs no fork or patch. Every fix the core needed has landed upstream in that release. Until it did, the native tools compiled with the `light-integration` branch of a fork; `native/scriptc.js` no longer looks for it.

```
SCRIPTC=/path/to/scriptc npm run verify
```

To move to another scriptc release, change `scriptc` in the root `package.json` and in `packages/light/package.json`, run `pnpm install`, and run the gates. With npm's `ignore-scripts` on, scriptc's install script does not run and the CLI answers "native installation is incomplete"; `pnpm rebuild scriptc --config.ignore-scripts=false` runs it for scriptc alone.

`native/scriptc.js` resolves the compiler for every tool, `light-native` included: `$SCRIPTC`, else the scriptc in the workspace's `node_modules`, else the one on `PATH`. `light desktop build` and `native/tui/pty.sh` follow it too.

The coverage gates run `--fail-on=blockers`: they fail on any blocker and on a divergence from node not listed in `divergences.json`, and, unless dynamic code is allowed, on any deferred or unreached site or a statically compiled share under 100%. scriptc's SC6101 warning, a function that likely runs often and works on untyped values (an `any`, an untyped `JSON.parse` result, an untyped JavaScript file), is printed as a note: the warning guesses which functions are hot, and data parsed from outside stays `unknown` on purpose.

| File | What it owns |
|---|---|
| `assert.ts` | `ok`, `eq`, `eqn`, `throws`, `budget`, `done`: the checks a native test uses, light's and its packages' (`@light/test` re-exports them), since node:test does not run under scriptc |
| `run.js` | The parity runner `npm run test:native` runs: every `*.test.js` of a target's folder under node and under `scriptc run` |
| `coverage.js`, `diagnostics.js`, `coverage-baseline.json` | The coverage gate `npm run verify` runs, over `native/tui/index.ts` and, with `--allow-dynamic`, the tasks app's entry; the reading of scriptc's JSON report it shares with the desktop gate and the probes; the counts the tasks graph may only lower |
| `scriptc.js` | Which scriptc the native tools and `light-native` run (`$SCRIPTC`, then the workspace's `node_modules`, then `PATH`) |
| `probes/` | One-file programs that pin what the compiler accepts, and the decisions they produced (`probes/README.md`) |
| `tui/`, `desktop/` | The targets |

The rules the shared code follows so that it compiles statically are in `probes/README.md`. The short form: values are `unknown` and are told apart by `typeof`, `instanceof` on module-level classes and `Array.isArray`; identity lives in classes, never in interfaces; a generic class never extends a generic class; a function-typed field never shares its name with a method; a callback handed to a library method annotates its parameters; no `any`; a `Map` holds class instances, never functions, so a tag's factory is a field of a `TagDefinition`; a `Signal<unknown>` is not a `Signal<T>`, so a declared prop is a `Prop<T>` wrapper over the unknown-typed signal; an empty array literal is typed where it is declared.
