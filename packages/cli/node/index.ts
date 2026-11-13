/**
 * @file `@lightstart/cli/node`: discovery that walks the folders and loads files with `import()`.
 */
export { discover, importFile } from "./discover.ts";
export { asPackageJson, findWorkspaceRoot, listScopedPackages, readPackageJson, toRel, walkFiles } from "./pkg-walk.ts";
export type { PackageJson, ScopedPackage, WalkOptions } from "./pkg-walk.ts";
export type { Discovered, DiscoverOptions, Discoverer } from "../types/discovery.ts";
