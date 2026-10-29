// node-only
/**
 * @file The node driver over node:sqlite: the same checks the native driver
 * answers, on node's own engine.
 */
import { Database } from "../node.ts";
import { runSuite } from "./suite.ts";

runSuite(() => Database.open(":memory:"));
