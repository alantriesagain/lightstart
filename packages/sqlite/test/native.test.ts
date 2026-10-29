// ffi: native/ffi.json
// native-only
/**
 * @file The native driver over the C shim. The shared suite runs here over
 * `native.ts` and under node over `node.ts`, so neither runtime is imitated.
 */
import { Database } from "../native.ts";
import { runSuite } from "./suite.ts";

runSuite((options) => Database.open(":memory:", options));
