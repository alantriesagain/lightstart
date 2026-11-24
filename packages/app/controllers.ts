/**
 * @file Naming and starting the manifest's controllers, and disposing them
 * again. A `defineController` handle is named so `sync:` reaches it by name
 * and its own build starts it: a member it declares, `start` included, is the
 * app's and is never called here (the members light adds all begin with `$`).
 * A `Controller` subclass (or any other controller with a `start()` hook) is
 * named too, then its `start()` runs. Either way the host waits for `$ready`.
 */

import { isControllerHandle, nameControllers } from "@lightstart/light/controller";
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
export const startControllers = (manifest: AppManifest): Promise<unknown[]> => startControllerList(manifest.controllers.map((entry) => entry.controller));

/** Name and start `list`'s controllers in order, then wait for each to be ready; answers them. */
export const startControllerList = async (list: readonly unknown[]): Promise<unknown[]> => {
  const controllers: unknown[] = [];
  const handles: Record<string, unknown>[] = [];
  for (const controller of list) {
    controllers.push(controller);
    const handle = recordOf(controller);
    if (handle !== null) handles.push(handle);
  }
  nameControllers(handles);
  for (const controller of handles) {
    if (isControllerHandle(controller)) continue;
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
