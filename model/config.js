/**
 * What the model reads from its host: the bus its warnings, its logs and
 * `model:changed` travel on. With none configured the model keeps its own,
 * so on a page with no host `onChange` hears what a store in the same page
 * writes.
 */

/** @import { ModelBus } from "./types.ts" */

/** @type {Map<string, Set<(data: unknown) => unknown>>} */
const listeners = new Map();

/** @type {ModelBus} */
const local = {
  on(key, cb) {
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  },
  emit(key, data) {
    for (const cb of [...(listeners.get(key) ?? [])]) cb(data);
  },
};

let bus = local;

/**
 * Hand the model its host's bus; without one it keeps its own.
 * @param {{ events?: ModelBus | null }} [options]
 */
export const configureModel = ({ events = null } = {}) => {
  bus = events ?? local;
};

/** The bus the model emits on and listens to. */
export const modelBus = () => bus;
