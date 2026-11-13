/**
 * @file @lightstart/light/check: light's convention checker for a host that
 * runs it. A replacement `light check` gets its own pass over a folder from
 * `checkTarget`, and can build one from `openProject`, `loadRules` and
 * `runRules` when it needs another shape.
 */
export * from "./define.js";
export * from "./engine.js";
export * from "./discover.js";
export * from "./project.js";
export * from "./context.js";
export * from "./format.js";
export * from "./walk.js";
export * from "./cli.js";
