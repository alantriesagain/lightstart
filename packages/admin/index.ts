/**
 * @file @lightstart/admin: a project admin as an `@lightstart/app` extension.
 * A project declares it in `src/admin.ts` (or `.js`) with `defineAdmin({ title,
 * folders })`; the extension contributes `/admin`, its shell and slots, and
 * this module is the page API tools build on: `files`, `history` and `dialogs`.
 * The dev file API the default `files` backend speaks is in `./node`.
 */

import { pathProblem } from "./paths.ts";
import { validateTools } from "./config.ts";

/** What `src/admin.ts` (or `.js`) declares. */
export interface AdminConfig {
  /** The shell's title; "Admin" when absent. */
  title?: string;
  /** Project-relative folders the admin may read and write. */
  folders: string[];
  /** Per-tool settings, a record of plain-data records; `{}` when absent. */
  tools?: Record<string, Record<string, unknown>>;
}

/** Keep the config's literal type and check every folder the admin may touch. */
export const defineAdmin = (config: AdminConfig): AdminConfig => {
  if (!Array.isArray(config.folders)) throw new Error("An admin config needs a folders array");
  const folders: string[] = [];
  for (const folder of config.folders) {
    if (typeof folder !== "string") throw new Error("An admin folder is a string");
    const problem = pathProblem(folder);
    if (problem !== null) throw new Error(`The admin folder "${folder}" is not allowed: ${problem}`);
    if (!folders.includes(folder)) folders.push(folder);
  }
  const tools = config.tools === undefined ? undefined : validateTools(config.tools);
  return tools === undefined ? { ...config, folders } : { ...config, folders, tools };
};

export type { AdminCommand, AdminHeaderItem, AdminSection } from "./slots.ts";
export { adminCommands, adminHeader, adminSections } from "./slots.ts";
export type { AdminSession, FileEntry, FilesBackend } from "./files.ts";
export { changed, configureFiles, DevFilesBackend, files, loadAdminSession } from "./files.ts";
export { canRedo, canUndo, clearHistory, history, labels, redo, snapshot, undo } from "./history.ts";
export type { ActiveDialog, ConfirmDialog, DialogKind, PromptDialog } from "./dialogs.ts";
export { activeDialog, confirm, dialogs, message, notify, prompt, setPromptValue, settle } from "./dialogs.ts";
export type { AdminNotification, AdminNotificationKind } from "./state.ts";
export type { AdminPageConfig } from "./state.ts";
export { addNotification, adminConfig, adminTitle, clearNotifications, notifications, notificationsOpen, toolConfig } from "./state.ts";
