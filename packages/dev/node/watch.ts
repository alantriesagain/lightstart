/**
 * @file The watcher behind `--watch`: a recursive `fs.watch` over the project, ignoring
 * `node_modules`, `.git` and `.deployed`, with change events debounced per path.
 */
import { watch, type FSWatcher } from "node:fs";
import type { Logger } from "@lightstart/cli";
import type { ServeFileChangedPayload } from "../hooks.ts";

/** The running watcher: one close for its stream and its pending timers. */
export type Watcher = {
  close(): void;
};

export type FileChangeEvent = ServeFileChangedPayload;
export type FileChangeListener = (event: FileChangeEvent) => void;

const DEBOUNCE_MS = 50;
const IGNORED = new Set(["node_modules", ".git", ".deployed"]);

const isIgnored = (filename: string): boolean => filename.split(/[\\/]/).some((segment) => IGNORED.has(segment));

/** Watch the project tree, reporting each settled change as a project-relative path. */
export const startWatcher = (projectDir: string, listener: FileChangeListener, log: Logger): Watcher => {
  const pending = new Map<string, NodeJS.Timeout>();
  const watcher: FSWatcher = watch(projectDir, { recursive: true }, (eventType, filename) => {
    if (filename === null || isIgnored(filename)) return;
    const path = filename.split("\\").join("/");
    const previous = pending.get(path);
    if (previous !== undefined) clearTimeout(previous);
    pending.set(path, setTimeout(() => {
      pending.delete(path);
      try {
        listener({ type: eventType === "rename" ? "rename" : "change", path });
      } catch (error) {
        log.error("[watch] listener error:", error instanceof Error ? error.message : String(error));
      }
    }, DEBOUNCE_MS));
  });
  watcher.on("error", (error: Error) => log.error("[watch] watcher error:", error.message));
  watcher.on("close", () => {
    for (const timer of pending.values()) clearTimeout(timer);
    pending.clear();
  });
  return {
    close: () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
      watcher.close();
    },
  };
};
