/**
 * @bootstrapp/light/native/desktop/host: the backend half of a desktop app. A DesktopApp opens
 * the operating system's web view through the shim, serves the page to it over loopback, pumps
 * the platform's event loop from a timer (so the program's own loop, with its timers, child
 * processes and sockets, keeps running), and carries the bridge: the page calls methods the app
 * registered with `handle`, the app pushes events with `emit`, the page pushes its own to the
 * app's `on` listeners. Compiled by scriptc into the app's executable; never run under node.
 */
import { dirname, join } from "node:path";
import { desktop_bind, desktop_create, desktop_destroy, desktop_eval, desktop_init, desktop_navigate, desktop_pump, desktop_return, desktop_set_size, desktop_set_title, desktop_terminate, desktop_unbind } from "./ffi.ts";
import { initScript } from "./init.js";
import { AssetServer, createAssetServer } from "./server.js";

/** @import { DesktopOptions, Handler } from "./types.ts" */

/** One method the page may call. */
export class Route {
  /**
   * @param {string} name
   * @param {Handler} invoke
   */
  constructor(name, invoke) {
    this.name = name;
    this.invoke = invoke;
  }
}

/** One listener of an event the page emits; `active` goes false when its unlisten function ran. */
export class Listener {
  /**
   * @param {string} name
   * @param {(value: unknown) => void} receive
   */
  constructor(name, receive) {
    this.name = name;
    this.receive = receive;
    this.active = true;
  }
}

/**
 * @param {unknown[]} args
 * @param {number} i
 * @returns {string} the argument when it is a string, else ""
 */
export const str = (args, i) => {
  const v = args[i];
  return typeof v === "string" ? v : "";
};

/**
 * @param {unknown[]} args
 * @param {number} i
 * @returns {number} the argument when it is a number, else 0
 */
export const num = (args, i) => {
  const v = args[i];
  return typeof v === "number" ? v : 0;
};

/**
 * @param {unknown[]} args
 * @param {number} i
 */
export const bool = (args, i) => args[i] === true;

/**
 * @param {unknown[]} args
 * @param {number} i
 * @returns {unknown[]} the argument when it is an array, else an empty one
 */
export const arr = (args, i) => {
  const v = args[i];
  return Array.isArray(v) ? v : [];
};

/** @type {DesktopApp | null} */
let active = null;

/**
 * The one function bound into the page, passed to the shim as is: a retained callback must be
 * the exact function value the manifest describes, so it is a module constant, not a field.
 * @param {string} id
 * @param {string} req
 */
const onCall = (id, req) => {
  if (active !== null) active.dispatchCall(id, req);
};

/** @param {string} name */
const argValue = (name) => {
  const at = process.argv.indexOf(name);
  return at >= 0 && at + 1 < process.argv.length ? process.argv[at + 1] : null;
};

export class DesktopApp {
  /** @param {DesktopOptions} options */
  constructor(options) {
    this.title = options.title ?? "light";
    this.width = options.width ?? 960;
    this.height = options.height ?? 640;
    this.debug = options.debug === true;
    this.pumpMs = options.pumpMs ?? 8;
    this.webDir = options.web ?? argValue("--web") ?? join(dirname(process.execPath), "web");
    /** @type {Map<string, Route>} */
    this.routes = new Map();
    /** @type {Listener[]} */
    this.listeners = [];
    /** @type {(() => void) | null} */
    this.onConnect = null;
    /** @type {(() => void) | null} */
    this.onClose = null;
    /** @type {((level: string, text: string) => void) | null} */
    this.onLog = null;
    this.w = 0n;
    this.running = false;
    this.ready = false;
    this.pumping = false;
    /** @type {AssetServer | null} */
    this.server = null;
  }

  /**
   * Register a method the page may call as `call.<name>(…)`.
   * @param {string} name
   * @param {Handler} invoke
   */
  handle(name, invoke) {
    this.routes.set(name, new Route(name, invoke));
  }

  /**
   * Listen for an event the page emits with `emit(name, value)`; the value arrives parsed from
   * JSON as `unknown`. Answers the function that removes the listener.
   * @param {string} name
   * @param {(value: unknown) => void} receive
   */
  on(name, receive) {
    const listener = new Listener(name, receive);
    /** @type {Listener[]} */
    const kept = [];
    for (const l of this.listeners) if (l.active) kept.push(l);
    kept.push(listener);
    this.listeners = kept;
    return () => {
      listener.active = false;
    };
  }

  /**
   * Push an event to the page's `on(name, …)` listeners. Before the page said it is ready,
   * nothing is pushed.
   * @param {string} name
   * @param {unknown} value
   */
  emit(name, value) {
    if (!this.ready || !this.running) return;
    desktop_eval(this.w, "window.__desktopEmit(" + JSON.stringify(name) + "," + JSON.stringify(value) + ")");
  }

  start() {
    const w = desktop_create(this.debug ? 1 : 0);
    if (w === 0n) throw new Error("[desktop] the web view could not be created; is WebKitGTK (Linux) or the WebView2 runtime (Windows) installed?");
    this.w = w;
    this.running = true;
    active = this;
    desktop_set_title(w, this.title);
    desktop_set_size(w, this.width, this.height, 0);
    desktop_init(w, initScript);
    desktop_bind(w, "__desktop", onCall);
    process.on("exit", () => {
      if (this.w !== 0n) desktop_unbind(this.w, "__desktop", onCall);
    });
    this.server = createAssetServer(this.webDir, join(this.webDir, "light"), (server) => {
      if (this.running) desktop_navigate(w, server.url("index.html"));
    });
    this.tick();
  }

  tick() {
    if (!this.running) return;
    if (!this.pumping) {
      this.pumping = true;
      const alive = desktop_pump(this.w);
      this.pumping = false;
      if (alive === 0) {
        this.close();
        return;
      }
    }
    setTimeout(() => this.tick(), this.pumpMs);
  }

  quit() {
    if (!this.running) return;
    desktop_terminate(this.w);
    this.close();
  }

  close() {
    if (!this.running) return;
    this.running = false;
    this.ready = false;
    const onClose = this.onClose;
    if (onClose !== null) onClose();
    if (this.server !== null) this.server.close();
    desktop_destroy(this.w);
    this.w = 0n;
    process.exit(0);
  }

  /**
   * One call from the page: `req` is the JSON array `[method, args]`.
   * @param {string} id
   * @param {string} req
   */
  dispatchCall(id, req) {
    const parsed = JSON.parse(req);
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== "string" || !Array.isArray(parsed[1])) {
      this.reply(id, false, "bad request");
      return;
    }
    const method = parsed[0];
    const args = parsed[1];
    if (method === "$ready") {
      this.ready = true;
      const onConnect = this.onConnect;
      if (onConnect !== null) onConnect();
      this.reply(id, true, null);
      return;
    }
    if (method === "$emit") {
      const name = str(args, 0);
      const value = args.length > 1 ? args[1] : null;
      const current = this.listeners.slice();
      for (const l of current) if (l.active && l.name === name) l.receive(value);
      this.reply(id, true, null);
      return;
    }
    if (method === "$log") {
      const level = str(args, 0);
      const text = str(args, 1);
      const onLog = this.onLog;
      if (onLog !== null) onLog(level, text);
      else process.stderr.write("[page " + level + "] " + text + "\n");
      this.reply(id, true, null);
      return;
    }
    const route = this.routes.get(method);
    if (route === undefined) {
      this.reply(id, false, "no method " + method);
      return;
    }
    route.invoke(args).then(
      (value) => this.reply(id, true, value),
      (error) => this.reply(id, false, error instanceof Error ? error.message : "error"),
    );
  }

  /**
   * @param {string} id
   * @param {boolean} ok
   * @param {unknown} value the result, or the error text
   */
  reply(id, ok, value) {
    if (!this.running) return;
    desktop_return(this.w, id, 0, ok ? JSON.stringify({ ok: true, value }) : JSON.stringify({ ok: false, error: value }));
  }
}
