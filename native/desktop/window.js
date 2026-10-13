/**
 * @bootstrapp/light/native/desktop/window: the operating system's web view as one object. A
 * DesktopWindow creates the view through the shim, binds the one page-callable function
 * `__desktop` (before any init script, since the view runs its user scripts in registration
 * order on every page load), installs init scripts, navigates, evaluates, answers calls, pumps
 * the platform's event loop from a timer so the program's own loop keeps running, and offers the
 * window's controls, the engine's inspector, a message box and non-modal file choosers. With
 * `frameless` the window opens without the system title bar and the page draws one; every page
 * gets `window.__desktopWindow` (window-host.js) to drive the window and follow its state. It knows
 * nothing of pages or protocols: DesktopApp builds light's bridge on it, and a host with its own
 * bridge and its own server builds on it directly. One window per process.
 */
import { desktop_begin_move, desktop_bind, desktop_close, desktop_create, desktop_destroy, desktop_dialog_bind, desktop_dialog_cancel, desktop_dialog_open, desktop_dialog_unbind, desktop_eval, desktop_init, desktop_inspector, desktop_is_maximized, desktop_maximize, desktop_message, desktop_minimize, desktop_navigate, desktop_pump, desktop_return, desktop_set_size, desktop_set_title, desktop_terminate, desktop_unbind, desktop_window_state } from "./ffi.ts";
import { windowHostScript } from "./window-host.js";

/** @import { DesktopWindowOptions } from "./types.ts" */

const WINDOW_CALL = "[\"$window\",";
const STATE_MAXIMIZED = 1;
const STATE_FRAMELESS = 16;

const platformName = () => (process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : "linux");

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

/**
 * The one function dialog results arrive through, a module constant for the same reason.
 * @param {number} id
 * @param {number} status
 * @param {string} paths
 */
const onDialog = (id, status, paths) => {
  if (active !== null) active.dialogResult(id, status, paths);
};

export class DesktopWindow {
  /** @param {DesktopWindowOptions} options */
  constructor(options) {
    this.title = options.title ?? "light";
    this.width = options.width ?? 960;
    this.height = options.height ?? 640;
    this.debug = options.debug === true;
    this.pumpMs = options.pumpMs ?? 8;
    this.frameless = options.frameless !== false;
    this.selectable = options.selectable === true;
    this.state = -1;
    /** @type {((id: string, req: string) => void) | null} */
    this.onRequest = null;
    /** @type {(() => void) | null} */
    this.onClose = null;
    /** @type {Map<number, (status: number, paths: string) => void>} */
    this.dialogs = new Map();
    this.w = 0n;
    this.running = false;
    this.pumping = false;
  }

  open() {
    const w = desktop_create(this.debug ? 1 : 0, this.frameless ? 1 : 0);
    if (w === 0n) throw new Error("[desktop] the web view could not be created; is WebKitGTK (Linux) or the WebView2 runtime (Windows) installed?");
    this.w = w;
    this.running = true;
    active = this;
    desktop_set_title(w, this.title);
    desktop_set_size(w, this.width, this.height, 0);
    desktop_bind(w, "__desktop", onCall);
    desktop_dialog_bind(w, onDialog);
    this.state = desktop_window_state(w);
    this.frameless = (this.state & STATE_FRAMELESS) !== 0;
    desktop_init(w, windowHostScript(platformName(), this.frameless, this.selectable));
    process.on("exit", () => {
      if (this.w === 0n) return;
      desktop_dialog_unbind(this.w, onDialog);
      desktop_unbind(this.w, "__desktop", onCall);
    });
    this.tick();
  }

  minimize() {
    if (this.running) desktop_minimize(this.w);
  }

  /** @param {boolean} on */
  maximize(on) {
    if (this.running) desktop_maximize(this.w, on ? 1 : 0);
  }

  isMaximized() {
    return this.running && desktop_is_maximized(this.w) === 1;
  }

  inspector() {
    if (this.running) desktop_inspector(this.w);
  }

  /**
   * A non-modal message box.
   * @param {string} title
   * @param {string} text
   */
  message(title, text) {
    if (this.running) desktop_message(this.w, title, text);
  }

  /**
   * Open a file chooser: `kind` 0 picks files, 1 a folder, 2 a file to save. Answers the chosen
   * paths (newline-joined; "" when cancelled) once the user is done; the dialog is not modal, the
   * pump keeps running. `path` is the folder to start in, or the suggested file for a save.
   * @param {number} kind
   * @param {string} title
   * @param {string} path
   * @param {boolean} multi
   * @returns {Promise<string>}
   */
  dialog(kind, title, path, multi) {
    return new Promise((resolve) => {
      if (!this.running) {
        resolve("");
        return;
      }
      const id = desktop_dialog_open(this.w, kind, title, path, multi ? 1 : 0);
      if (id < 0) {
        resolve("");
        return;
      }
      this.dialogs.set(id, (status, paths) => resolve(status === 1 ? paths : ""));
    });
  }

  pendingDialogs() {
    /** @type {number[]} */
    const ids = [];
    for (const id of this.dialogs.keys()) ids.push(id);
    return ids;
  }

  /** Withdraw an open dialog; it answers as cancelled. @param {number} id */
  cancelDialog(id) {
    if (this.running) desktop_dialog_cancel(this.w, id);
  }

  /**
   * @param {number} id
   * @param {number} status
   * @param {string} paths
   */
  dialogResult(id, status, paths) {
    const settle = this.dialogs.get(id);
    if (settle === undefined) return;
    this.dialogs.delete(id);
    settle(status, paths);
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
    if (req.startsWith(WINDOW_CALL)) {
      this.windowCall(id, req);
      return;
    }
    const fn = this.onRequest;
    if (fn !== null) fn(id, req);
  }

  /**
   * A call from the page's window host: `["$window", [op]]`. The state is answered, the other
   * operations are acknowledged first and carried out after.
   * @param {string} id
   * @param {string} req
   */
  windowCall(id, req) {
    /** @type {unknown} */
    const parsed = JSON.parse(req);
    if (!Array.isArray(parsed) || parsed.length < 2) {
      this.answer(id, "null");
      return;
    }
    const args = parsed[1];
    const op = Array.isArray(args) && typeof args[0] === "string" ? args[0] : "";
    const x = Array.isArray(args) && typeof args[1] === "number" ? Math.round(args[1]) : -1;
    const y = Array.isArray(args) && typeof args[2] === "number" ? Math.round(args[2]) : -1;
    if (op === "state") {
      this.answer(id, String(this.windowState()));
      return;
    }
    this.answer(id, "null");
    if (op === "minimize") this.minimize();
    else if (op === "maximize") this.toggleMaximize();
    else if (op === "close") this.requestClose();
    else if (op === "drag") this.beginMove(x, y);
  }

  toggleMaximize() {
    if (this.running) desktop_maximize(this.w, (this.windowState() & STATE_MAXIMIZED) !== 0 ? 0 : 1);
  }

  /**
   * @param {number} x where the press happened on the screen, or -1 for where the pointer is now
   * @param {number} y
   */
  beginMove(x, y) {
    if (this.running) desktop_begin_move(this.w, x, y);
  }

  requestClose() {
    if (this.running) desktop_close(this.w);
  }

  windowState() {
    return this.running ? desktop_window_state(this.w) : 0;
  }

  pushState() {
    const state = this.windowState();
    if (state === this.state) return;
    this.state = state;
    this.eval("window.__desktopWindowState&&window.__desktopWindowState(" + String(state) + ")");
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
      this.pushState();
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
