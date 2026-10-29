# Driver probes

`bench-node.ts` and `bench-native.ts` run the same `bench-suite.ts` over
`:memory:`, so the ratio is FFI and JSON-building cost, not disk. From
`packages/sqlite`:

```bash
node probes/bench-node.ts
scriptc-dev run --optimization release --ffi native/ffi.json probes/bench-native.ts
```

Both drivers answer the same values; the shared `test/suite.ts` holds them to
it, under node over `node.ts` and natively over the C shim.

The best of five interleaved runs on a 2026 Linux laptop under other load:

```
node:sqlite
point read                      413223 ops/s
100-row json                      9569 ops/s
insert in its transaction       256410 ops/s
100 inserts in one transaction    5181 ops/s

native shim (release)
point read                      564972 ops/s
100-row json                     31153 ops/s
insert in its transaction       294118 ops/s
100 inserts in one transaction    6173 ops/s
```

A native `run` is one call (its changes and last rowid come back in a small
buffer), and a transaction's `BEGIN`, `COMMIT` and savepoints are cached
statements, so a transaction parses no SQL.

The native shim's `json()` is one FFI call that builds the array in C; the node
driver stringifies the row objects JavaScript already made.
