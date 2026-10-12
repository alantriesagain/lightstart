# Native probes

One-file programs that decide how light's shared core is written so that scriptc compiles it to a
static binary. `node native/probes/run.js [--scriptc <path>] [p-a …]` reports coverage, builds
each probe natively, runs it, diffs the output against node, and writes `RESULTS.md`. Rerun them on
every scriptc upgrade.

## Decisions (scriptc 0.2.9 and 0.2.10 behave identically on every probe)

| Probe | Outcome | Decision |
|---|---|---|
| p-a-dispatch: `unknown` values dispatched by `typeof`, `instanceof` (module-level classes), `Array.isArray`, identity through `unknown`, handlers invoked with `fn.call(owner, event)`, `Map<unknown, number>` | PASS, except `String(object)` on a checked object (`Object.getPrototypeOf … not supported`) and reading a `Symbol.for` class field through a narrowed value (ICE SC9001) | The core keeps light's value model: values are `unknown`, `html()`/`key()`/… return class instances, `_commitResolved` dispatches with `typeof`/`instanceof`/`Array.isArray`. The `[TPL]`/`[WRAP]` symbol fields are written for compatibility and never read by the core. The last-resort `String(value)` goes through `host.stringify`. Thunks and handlers stay bare functions. |
| p-b-host: a `Host` base whose methods throw, a subclass installed through a module-level variable, opaque `unknown` nodes with identity, a `@typedef` union in a class field, nullable function fields, `Set` of instances, an overridden getter | PASS | The host seam is a class with `configure({ host })`, exactly as designed. |
| p-d-signals: `Dep` non-generic base, `Signal<T>` and `Computed<T>` as sibling subclasses, `Reactive` base class, wave-draining notify, `subscribe` | PASS | M4 signals shape. |
| p-g1 … p-g4: JavaScript generic classes | one generic class: PASS; **a generic subclass of a generic class: ICE** ("generic family has an incompatible prefix"); a generic subclass of a non-generic base: PASS; composition: PASS | `Computed` must not extend `Signal`; both extend `Dep`. Light's structural `Reactive` interface casts (`/** @type {Reactive} */ (this)`) compile to deferred throws ("opaque structural views"), so `Reactive` becomes a class. |
| p-c (in the harness, `probes/p-c-*`): a TypeScript program importing light's JavaScript by relative path and through a tsconfig `paths` alias | both resolve as program modules; `paths` is scriptc-only (node needs an import map) | The harness imports light by relative path. Any light file imported pulls in everything its `types.ts` references, so shared type files must not reference host modules (`html/types.ts` currently reaches `slots.js`). |
| harness probes p0–p31 on 0.2.10 | identical pass/fail set to 0.2.9 | light pins scriptc 0.2.10; the harness upgrades when it switches to light. |

Rules carried over from the harness (`writting-harness/probes/README.md`): no recursive array unions in TypeScript, never `instanceof` on a union with an array arm, a function-typed field must not share a name with any method in the program, `Set` of functions is rejected (arrays are fine).
