# Driver probes

`bench-node.ts` and `bench-native.ts` run the same `bench-suite.ts` over
`:memory:`, so the ratio is FFI and JSON-building cost, not disk. From
`packages/sqlite`:

```bash
node probes/bench-node.ts
scriptc-dev run --ffi native/ffi.json probes/bench-native.ts
```

Both drivers are also held to identical output by
`test/driver.test.ts` (native over the archive, node over
`native/sqlite-node.mjs`).

A representative run on a 2026 Linux laptop:

```
node:sqlite
point read                      505051 ops/s
100-row json                      7003 ops/s
insert in its transaction       285714 ops/s
100 inserts in one transaction    5747 ops/s

native shim
point read                      534759 ops/s
100-row json                     33223 ops/s
insert in its transaction       238095 ops/s
100 inserts in one transaction    4329 ops/s
```

The native shim's `json()` is one FFI call that builds the array in C; the node
driver stringifies the row objects JavaScript already made.
