/**
 * @lightstart/light/model/events: the occurrences the model reports, each a
 * typed `event` from `@lightstart/light/signals/event`. `on` answers the
 * unsubscribe; delivery is synchronous.
 */

import { event } from "../signals/event.ts";

import type { ModelChanged, ModelNote } from "./types.ts";

/** Every write, once the adapter stored it: `add`, `edit`, `remove` or a whole-collection `sync`. */
export const modelChanged = event<ModelChanged>();
/** A failure the model reports. */
export const modelError = event<ModelNote>();
/** A warning the model reports. */
export const modelWarn = event<ModelNote>();
/** A storage adapter registered under a type. */
export const adapterRegistered = event<{ type: string }>();
/** An adapter instance made for a database. */
export const databaseCreated = event<{ type: string; name?: string; version?: number | string }>();
/** A failure the IndexedDB adapter reports. */
export const idbError = event<ModelNote>();
/** A line the IndexedDB adapter logs. */
export const idbLog = event<ModelNote>();
/** A warning the IndexedDB adapter reports. */
export const idbWarn = event<ModelNote>();
