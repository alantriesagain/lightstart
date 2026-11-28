/**
 * @file @lightstart/admin/node: reading a project's admin config and the
 * guarded dev file API `light serve` mounts. Node-only.
 */

export type { AdminConfig } from "../index.ts";
export { adminFoldersOf, adminPathOf, adminTitleOf, adminToolsOf, readAdmin, validateFolders } from "./config.ts";
export type { AdminApiOptions } from "./serve.ts";
export { ADMIN_BODY_LIMIT, ADMIN_TOKEN_HEADER, createAdminApp, newAdminToken, resolveAdminPath } from "./serve.ts";
