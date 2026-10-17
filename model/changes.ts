/**
 * Live change fan-out on one runtime: `onChange(model, where, cb)` runs `cb`
 * for every `model:changed` event on `model` whose row matches `where` (a
 * removal always matches, so a holder can drop the row, and so does a `sync`,
 * which carries no row and means the whole collection changed). One listener
 * on the model's bus, installed on first use and moved when the host hands the
 * model another bus; a host that runs the store elsewhere (a worker) forwards
 * its `model:changed` onto that bus.
 */

import { modelBus } from "./config.ts";
import { MODEL_CHANGED, MODEL_ERROR } from "./events.ts";
import { compileMatcher } from "./query-builder.ts";

import type { ChangeCallback, ChangeSubscriber, ModelBus, ModelChanged, Row, WhereClause } from "./types.ts";

const subscribers: Map<string, Set<ChangeSubscriber>> = new Map();
let listening: ModelBus | null = null;
let stop: (() => void) | null = null;

const dispatch = (event: ModelChanged): void => {
  const set = subscribers.get(event.model);
  if (!set) return;
  for (const { match, cb } of [...set])
    if (event.action === "remove" || event.action === "sync" || match(event.row as Row))
      try {
        cb(event);
      } catch (error) {
        modelBus().emit(MODEL_ERROR, { type: "change_callback_failed", model: event.model, error });
      }
};

const install = (): void => {
  const bus = modelBus();
  if (listening === bus) return;
  stop?.();
  listening = bus;
  stop = bus.on(MODEL_CHANGED, (data) => dispatch(data as ModelChanged));
};

/** Run `cb` for every change on `model` whose row matches `where`; the answer stops it. */
export const onChange = (model: string, where: WhereClause | undefined, cb: ChangeCallback): (() => void) => {
  install();
  const entry: ChangeSubscriber = { match: compileMatcher(where), cb };
  let set = subscribers.get(model);
  if (!set) subscribers.set(model, (set = new Set()));
  set.add(entry);
  return () => {
    set.delete(entry);
    if (set.size === 0) subscribers.delete(model);
  };
};
