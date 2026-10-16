/**
 * What the model reads from its host: the bus its warnings, its logs and
 * `model:changed` travel on, and where a new row's id comes from. With no bus
 * configured the model keeps its own, so on a page with no host `onChange`
 * hears what a store in the same page writes; with no id source it draws
 * from `Math.random`, which every runtime light compiles to has.
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

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

const randomId = () => {
  let id = "";
  for (let i = 0; i < 15; i++) id += ALPHABET[Math.floor(Math.random() * 36)];
  return id;
};

let bus = local;
let makeId = randomId;

/**
 * Hand the model its host's bus and id source; without them it keeps its
 * own. `makeId` answers a new row's id when the caller sent none.
 * @param {{ events?: ModelBus | null, makeId?: (() => string) | null }} [options]
 */
export const configureModel = (options = {}) => {
  bus = options.events ?? local;
  makeId = options.makeId ?? randomId;
};

/** A new row's id, from the configured source. */
export const newId = () => makeId();

/** The bus the model emits on and listens to. */
export const modelBus = () => bus;
