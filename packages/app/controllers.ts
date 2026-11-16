/**
 * @file Naming and starting the manifest's controllers, and disposing them
 * again. A `defineController` handle is named so `sync:` reaches it by name
 * and its own build starts it; a `Controller` subclass is named too, then
 * `start()` runs its `connected()`. Either way the host waits for `$ready`.
 */

import { nameControllers } from "@lightstart/light/controller";
import type { AppManifest } from "./manifest.ts";

const recordOf = (value: unknown): Record<string, unknown> | null =>
  (typeof value === "object" && value !== null ? value as Record<string, unknown> : null);

const functionOf = (record: Record<string, unknown>, name: string): ((...args: never[]) => unknown) | null => {
  const value = record[name];
  return typeof value === "function" ? value as (...args: never[]) => unknown : null;
};

const thenOf = (value: unknown): Promise<unknown> | null =>
  (typeof value === "object" && value !== null && "then" in value ? value as Promise<unknown> : null);

/** Name and start every controller the manifest carries; answers the handles it started. */
export const startControllers = async (manifest: AppManifest): Promise<unknown[]> => {
  const controllers = manifest.controllers.map((entry) => entry.controller);
  const handles = controllers.filter((entry): entry is Record<string, unknown> => recordOf(entry) !== null);
  nameControllers(handles);
  for (const controller of handles) {
    const start = functionOf(controller, "start");
    if (start !== null) await start.call(controller);
  }
  for (const controller of handles) {
    const ready = thenOf(controller["$ready"]);
    if (ready !== null) await ready;
  }
  return controllers;
};

/** Dispose every controller the manifest carries, in reverse order. */
export const stopControllers = async (controllers: readonly unknown[]): Promise<void> => {
  for (let i = controllers.length - 1; i >= 0; i--) {
    const controller = recordOf(controllers[i]);
    if (controller === null) continue;
    const dispose = functionOf(controller, "dispose");
    if (dispose !== null) await dispose.call(controller);
  }
};
