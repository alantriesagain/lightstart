/**
 * What the model reads from its host: the request every model api sends
 * through, the bus its warnings, its logs and `model:changed` travel on, and
 * where a new row's id comes from. The request is a store in the same
 * runtime (`storeRequest(store)`) or a port to one elsewhere; until one is
 * configured a call rejects. With no bus configured the model keeps its own,
 * so on a page with no host `onChange` hears what a store in the same page
 * writes; with no id source it draws from `Math.random`, which every runtime
 * light compiles to has.
 */

import type { ModelBus, ModelRequest } from "./types.ts";

const listeners: Map<string, Array<(data: unknown) => unknown>> = new Map();

const local: ModelBus = {
  on(key, cb) {
    let list = listeners.get(key);
    if (!list) listeners.set(key, (list = []));
    if (!list.includes(cb)) list.push(cb);
    return () => {
      const at = list.indexOf(cb);
      if (at >= 0) list.splice(at, 1);
    };
  },
  emit(key, data) {
    for (const cb of [...(listeners.get(key) ?? [])]) cb(data);
  },
};

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

const randomId = (): string => {
  let id = "";
  for (let i = 0; i < 15; i++) id += ALPHABET[Math.floor(Math.random() * 36)];
  return id;
};

const unconfigured: ModelRequest = async (action, model) => {
  throw new Error(`Model "${model}": ${action} has no request to go through; call configureModel({ request })`);
};

let request: ModelRequest = unconfigured;
let bus: ModelBus = local;
let makeId: () => string = randomId;

/**
 * Hand the model its host's request, bus and id source; without a bus or an
 * id source it keeps its own. `makeId` answers a new row's id when the caller
 * sent none.
 */
export const configureModel = (options: { request?: ModelRequest | null, events?: ModelBus | null, makeId?: (() => string) | null } = {}): void => {
  request = options.request ?? unconfigured;
  bus = options.events ?? local;
  makeId = options.makeId ?? randomId;
};

/** The request a model api sends through, read when the call is made. */
export const modelRequest = (): ModelRequest => request;

/** A new row's id, from the configured source. */
export const newId = (): string => makeId();

/** The bus the model emits on and listens to. */
export const modelBus = (): ModelBus => bus;
