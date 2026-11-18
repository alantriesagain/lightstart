/**
 * What the model reads from its host: the request every model api sends
 * through, and where a new row's id comes from. The request is a store in the
 * same runtime (`storeRequest(store)`) or a port to one elsewhere; until one
 * is configured a call rejects. With no id source it draws from
 * `Math.random`, which every runtime light compiles to has.
 */

import type { ModelRequest } from "./types.ts";

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
let makeId: () => string = randomId;

/**
 * Hand the model its host's request and id source; without an id source it
 * keeps its own. `makeId` answers a new row's id when the caller sent none.
 */
export const configureModel = (options: { request?: ModelRequest | null, makeId?: (() => string) | null } = {}): void => {
  request = options.request ?? unconfigured;
  makeId = options.makeId ?? randomId;
};

/** The request a model api sends through, read when the call is made. */
export const modelRequest = (): ModelRequest => request;

/** A new row's id, from the configured source. */
export const newId = (): string => makeId();
