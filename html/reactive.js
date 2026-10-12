import { currentHost, setHost } from "./host.js";

/** @import { EffectAdapter, ThunkHolder } from "./types.ts" */

/** @type {EffectAdapter | null} */
let adapter = null;

/**
 * Inject the reactive-effect adapter used for `${() => ...}` thunk
 * bindings. The view engine passes `effect` from light/signals when it
 * loads. Without an adapter,
 * thunks are evaluated once per parent render, correct but coarse.
 *
 * @param {{ effect?: EffectAdapter, host?: import("./host.js").Host }} [config]
 */
export const configure = ({ effect, host } = {}) => {
  adapter = effect ?? null;
  if (host !== undefined) setHost(host);
};

/** @param {ThunkHolder} part */
export const disposeThunk = (part) => {
  part._effect?.dispose();
  part._effect = null;
  part._thunk = undefined;
  part._thunkLive = false;
};

/**
 * Bind a thunk to a part. With an adapter, the thunk runs inside a
 * reactive effect that re-commits directly into the part on dependency
 * change, no parent re-render. A parent re-render with a new closure
 * identity swaps the effect; an effect firing after its anchor left the
 * document disposes itself.
 *
 * @param {ThunkHolder} part
 * @param {() => unknown} fn
 * @param {(value: unknown) => void} commit
 */
export const setThunk = (part, fn, commit) => {
  if (part._thunk === fn) return;
  disposeThunk(part);
  part._thunk = fn;
  if (!adapter) {
    commit(fn());
    return;
  }
  part._effect = adapter(() => {
    const anchor = part.start ?? part.el;
    if (anchor !== undefined && anchor !== null && currentHost().isConnected(anchor)) part._thunkLive = true;
    else if (part._thunkLive) {
      disposeThunk(part);
      return;
    }
    commit(fn());
  });
};

/** @param {unknown} value */
export const resolveEager = (value) => (typeof value === "function" ? value() : value);
