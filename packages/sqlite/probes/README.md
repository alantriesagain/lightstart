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

A representative run on a 2026 Linux laptop:

```
node:sqlite
point read                      515464 ops/s
100-row json                     10627 ops/s
insert in its transaction       270270 ops/s
100 inserts in one transaction    5814 ops/s

native shim (release)
point read                      636943 ops/s
100-row json                     38911 ops/s
insert in its transaction       270270 ops/s
100 inserts in one transaction    4762 ops/s
```

The native shim's `json()` is one FFI call that builds the array in C; the node
driver stringifies the row objects JavaScript already made.
