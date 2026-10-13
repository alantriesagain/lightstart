/**
 * @bootstrapp/light/native/desktop/window: the operating system's web view as one object. A
 * DesktopWindow creates the view through the shim, binds the one page-callable function
 * `__desktop` (before any init script, since the view runs its user scripts in registration
 * order on every page load), installs init scripts, navigates, evaluates, answers calls, and pumps
 * the platform's event loop from a timer so the program's own loop keeps running. It knows
 * nothing of pages or protocols: DesktopApp builds light's bridge on it, and a host with its own
 * bridge and its own server builds on it directly. One window per process.
 */
import { desktop_bind, desktop_create, desktop_destroy, desktop_eval, desktop_init, desktop_navigate, desktop_pump, desktop_return, desktop_set_size, desktop_set_title, desktop_terminate, desktop_unbind } from "./ffi.ts";

/** @import { DesktopWindowOptions } from "./types.ts" */

/** @type {DesktopWindow | null} */
let active = null;

/**
 * The one function bound into the page, passed to the shim as is: a retained callback must be
 * the exact function value the manifest describes, so it is a module constant, not a field.
 * @param {string} id
 * @param {string} req
 */
const onCall = (id, req) => {
  if (active !== null) active.receive(id, req);
};

export class DesktopWindow {
  /** @param {DesktopWindowOptions} options */
  constructor(options) {
    this.title = options.title ?? "light";
    this.width = options.width ?? 960;
    this.height = options.height ?? 640;
    this.debug = options.debug === true;
    this.pumpMs = options.pumpMs ?? 8;
    /** @type {((id: string, req: string) => void) | null} */
    this.onRequest = null;
    /** @type {(() => void) | null} */
    this.onClose = null;
    this.w = 0n;
    this.running = false;
    this.pumping = false;
  }

  open() {
    const w = desktop_create(this.debug ? 1 : 0);
    if (w === 0n) throw new Error("[desktop] the web view could not be created; is WebKitGTK (Linux) or the WebView2 runtime (Windows) installed?");
    this.w = w;
    this.running = true;
    active = this;
    desktop_set_title(w, this.title);
    desktop_set_size(w, this.width, this.height, 0);
    desktop_bind(w, "__desktop", onCall);
    process.on("exit", () => {
      if (this.w !== 0n) desktop_unbind(this.w, "__desktop", onCall);
    });
    this.tick();
  }

  /**
   * Install a script that runs at document start on every page load, after the bridge binding.
   * @param {string} js
   */
  init(js) {
    if (this.running) desktop_init(this.w, js);
  }

  /** @param {string} url */
  navigate(url) {
    if (this.running) desktop_navigate(this.w, url);
  }

  /** Evaluate in the page; nothing happens before the first navigation. @param {string} js */
  eval(js) {
    if (this.running) desktop_eval(this.w, js);
  }

  /**
   * Call the page's `window.__desktopEmit(name, value)`, the event side of light's bridge.
   * @param {string} name
   * @param {unknown} value
   */
  emit(name, value) {
    this.eval("window.__desktopEmit(" + JSON.stringify(name) + "," + JSON.stringify(value) + ")");
  }

  /**
   * Answer one call from the page: `json` is what the page's Promise resolves to.
   * @param {string} id
   * @param {string} json
   */
  answer(id, json) {
    if (this.running) desktop_return(this.w, id, 0, json);
  }

  /**
   * A call from the page, delivered inside a pump: `req` is the JSON array of its arguments.
   * @param {string} id
   * @param {string} req
   */
  receive(id, req) {
    const fn = this.onRequest;
    if (fn !== null) fn(id, req);
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
    const onClose = this.onClose;
    if (onClose !== null) onClose();
    desktop_destroy(this.w);
    this.w = 0n;
  }
}
