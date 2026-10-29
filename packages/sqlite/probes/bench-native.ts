// ffi: native/ffi.json
/**
 * @file The driver benchmark over the native shim. Run from `packages/sqlite`:
 * `scriptc-dev run --ffi native/ffi.json probes/bench-native.ts`.
 */
import { Database } from "../native.ts";
import { runBench } from "./bench-suite.ts";

runBench("native shim", () => Database.open(":memory:"));
