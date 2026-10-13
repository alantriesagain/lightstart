/**
 * @bootstrapp/light/native/desktop/client: the page half of the bridge. `connect()` answers the
 * contract as a typed proxy whose every method calls the backend through the webview's
 * `window.__desktop` binding, the event listeners the init script installed, a log that reaches
 * the backend's stderr, and `ready()`, which tells the backend the page is up. Browser code; a
 * page loads it through the import map as @bootstrapp/light/native/desktop/client.js.
 */

/** @import { Contract, Desktop, Events } from "./types.ts" */

/**
 * @typedef {{
 *   __desktop: (method: string, args: unknown[]) => Promise<unknown>,
 *   __desktopListen: (name: string, fn: (value: never) => void) => void,
 *   __desktopUnlisten: (name: string, fn: (value: never) => void) => void,
 * }} Bridge
 */

/** @returns {Bridge} */
const bridge = () => {
  const w = /** @type {Partial<Bridge>} */ (/** @type {unknown} */ (globalThis));
  if (typeof w.__desktop !== "function" || typeof w.__desktopListen !== "function" || typeof w.__desktopUnlisten !== "function")
    throw new Error("[desktop] this page is not running inside a light desktop app");
  return /** @type {Bridge} */ (w);
};

/**
 * @param {string} method
 * @param {unknown[]} args
 */
const invoke = async (method, args) => {
  const raw = await bridge().__desktop(method, args);
  const reply = /** @type {{ ok?: unknown, value?: unknown, error?: unknown }} */ (raw ?? {});
  if (reply.ok === true) return reply.value;
  throw new Error(typeof reply.error === "string" ? reply.error : "desktop call failed");
};

/**
 * Connect to the backend. The type parameters are the app's contract and events, declared once
 * and imported by both sides.
 * @template {Contract} C
 * @template {Events} E
 * @returns {Desktop<C, E>}
 */
export const connect = () => {
  const b = bridge();
  const call = /** @type {Desktop<C, E>["call"]} */ (new Proxy({}, {
    get: (_target, property) => (/** @type {unknown[]} */ ...args) => invoke(String(property), args),
  }));
  return {
    call,
    on: /** @type {Desktop<C, E>["on"]} */ ((name, fn) => b.__desktopListen(name, fn)),
    off: /** @type {Desktop<C, E>["off"]} */ ((name, fn) => b.__desktopUnlisten(name, fn)),
    log: async (level, text) => {
      await invoke("$log", [level, text]);
    },
    ready: async () => {
      await invoke("$ready", []);
    },
  };
};
