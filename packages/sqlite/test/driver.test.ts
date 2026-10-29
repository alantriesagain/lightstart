// ffi: native/ffi.json
/**
 * @file The native driver under both runtimes: natively over the C shim, and
 * under node over the manifest folder's node stand-in. The checks and their
 * output are the same.
 */
import { Database } from "../native.ts";
import { runSuite } from "./suite.ts";

runSuite(() => Database.open(":memory:"));
