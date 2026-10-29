/**
 * @file The driver benchmark over node:sqlite. Run from `packages/sqlite`:
 * `node probes/bench-node.ts`.
 */
import { Database } from "../node.ts";
import { runBench } from "./bench-suite.ts";

runBench("node:sqlite", () => Database.open(":memory:"));
