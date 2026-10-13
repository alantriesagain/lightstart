import { Part } from "./part.ts";
import { currentHost, setHost } from "./host.ts";

import type { EffectAdapter, EffectHandle, HostNode } from "./types.ts";

let adapter: EffectAdapter | null = null;

/**
 * Inject the reactive-effect adapter used for `${() => ...}` thunk
 * bindings. The view engine passes `effect` from light/signals when it
 * loads. Without an adapter,
 * thunks are evaluated once per parent render, correct but coarse.
 */
export const configure = (options?: { effect?: EffectAdapter, host?: import("./host.ts").Host }) => {
  const o = options ?? {};
  adapter = o.effect ?? null;
  if (o.host !== undefined) setHost(o.host);
};

/**
 * The thunk-binding state of a part: the thunk it holds, the effect running
 * it, and whether that effect has seen its anchor connected. Parts that take
 * `${() => …}` bindings extend it and answer `_anchor()`.
 */
export class ThunkHolder extends Part {
  _thunk: (() => unknown) | undefined;
  _effect: EffectHandle | null;
  _thunkLive: boolean;

  constructor() {
    super();
    this._thunk = undefined;
    this._effect = null;
    this._thunkLive = false;
  }

  /** @returns the node whose connectivity decides whether the effect stays alive */
  _anchor(): HostNode | null {
    return null;
  }
}

export const disposeThunk = (part: ThunkHolder) => {
  const effect = part._effect;
  if (effect !== null) effect.dispose();
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
 */
export const setThunk = (part: ThunkHolder, fn: () => unknown, commit: (value: unknown) => void) => {
  if (part._thunk === fn) return;
  disposeThunk(part);
  part._thunk = fn;
  if (!adapter) {
    commit(fn());
    return;
  }
  part._effect = adapter(() => {
    const anchor = part._anchor();
    if (anchor !== null && anchor !== undefined && currentHost().isConnected(anchor)) part._thunkLive = true;
    else if (part._thunkLive) {
      disposeThunk(part);
      return;
    }
    commit(fn());
  });
};

export const resolveEager = (value: unknown): unknown => (typeof value === "function" ? value() : value);
