/**
 * Live change fan-out on one runtime: `onChange(model, where, cb)` runs `cb`
 * for every `model:changed` event on `model` whose row matches `where` (a
 * removal always matches, so a holder can drop the row, and so does a `sync`,
 * which carries no row and means the whole collection changed). One listener
 * on the model's bus, installed on first use and moved when the host hands the
 * model another bus; a host that runs the store elsewhere (a worker) forwards
 * its `model:changed` onto that bus.
 */

import { modelBus } from "./config.js";
import { MODEL_CHANGED, MODEL_ERROR } from "./events.js";
import { compileMatcher } from "./query-builder.js";

/** @import { ChangeCallback, ModelBus, ModelChanged, Row, WhereClause } from "./types.ts" */

/** @type {Map<string, Set<{ match: (row: Record<string, unknown>) => boolean, cb: ChangeCallback }>>} */
const subscribers = new Map();
/** @type {ModelBus | null} */
let listening = null;
/** @type {(() => void) | null} */
let stop = null;

/** @param {ModelChanged} event */
const dispatch = (event) => {
  const set = subscribers.get(event.model);
  if (!set) return;
  for (const { match, cb } of [...set])
    if (event.action === "remove" || event.action === "sync" || match(/** @type {Row} */ (event.row)))
      try {
        cb(event);
      } catch (error) {
        modelBus().emit(MODEL_ERROR, { type: "change_callback_failed", model: event.model, error });
      }
};

const install = () => {
  const bus = modelBus();
  if (listening === bus) return;
  stop?.();
  listening = bus;
  stop = bus.on(MODEL_CHANGED, (data) => dispatch(/** @type {ModelChanged} */ (data)));
};

/**
 * @param {string} model
 * @param {WhereClause | undefined} where
 * @param {ChangeCallback} cb
 * @returns {() => void}
 */
export const onChange = (model, where, cb) => {
  install();
  const entry = { match: compileMatcher(where), cb };
  let set = subscribers.get(model);
  if (!set) subscribers.set(model, (set = new Set()));
  set.add(entry);
  return () => {
    set.delete(entry);
    if (set.size === 0) subscribers.delete(model);
  };
};
