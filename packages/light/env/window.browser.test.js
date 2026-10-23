/**
 * The window host a desktop shell installs (`native/desktop/window-host.js`),
 * run against a stand-in for the shell's binding: `env.window` answers it,
 * a drag starts only after the pointer travelled, a double-click maximizes,
 * and state pushes reach subscribers once per change.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { env } from "@bootstrapp/light/env";
import { windowHostScript } from "@bootstrapp/light/native/desktop/window-host.js";

/** @type {unknown[][]} */
const calls = [];
/** @type {any} */ (globalThis).__desktop = (/** @type {string} */ method, /** @type {unknown[]} */ args) => {
  calls.push([method, ...args]);
  return Promise.resolve(args[0] === "state" ? 17 : null);
};
(0, eval)(windowHostScript("linux", true));
const host = /** @type {import("@bootstrapp/light/env/types.ts").WindowHost} */ (env.window);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const ops = () => calls.map((c) => c[1]);

/**
 * @param {string} type
 * @param {Record<string, number>} init
 */
const mouse = (type, init) => new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });

describe("the desktop window host", () => {
  it("is what env.window answers, with the platform and the first state", async () => {
    await flush();
    assert.equal(env.window, host);
    assert.equal(host.platform, "linux");
    assert.equal(host.frameless, true);
    assert.equal(host.nativeControls, false);
    assert.equal(host.maximized, true);
    assert.deepEqual(ops(), ["state"]);
  });

  it("starts a drag only after the pointer travelled with the button down", () => {
    calls.length = 0;
    const down = mouse("mousedown", { screenX: 100, screenY: 100, detail: 1 });
    host.dragFrom(down);
    assert.equal(down.defaultPrevented, true);
    window.dispatchEvent(mouse("mousemove", { screenX: 102, screenY: 100, buttons: 1 }));
    assert.deepEqual(ops(), []);
    window.dispatchEvent(mouse("mousemove", { screenX: 110, screenY: 100, buttons: 1 }));
    window.dispatchEvent(mouse("mousemove", { screenX: 130, screenY: 100, buttons: 1 }));
    assert.deepEqual(ops(), ["drag"]);
    assert.deepEqual(calls[0].slice(2), [100, 100]);
  });

  it("leaves a click alone and turns a double-click into maximize", () => {
    calls.length = 0;
    host.dragFrom(mouse("mousedown", { screenX: 5, screenY: 5, detail: 1 }));
    window.dispatchEvent(mouse("mouseup", { screenX: 5, screenY: 5 }));
    window.dispatchEvent(mouse("mousemove", { screenX: 50, screenY: 5, buttons: 0 }));
    assert.deepEqual(ops(), []);
    host.dragFrom(mouse("mousedown", { screenX: 5, screenY: 5, detail: 2 }));
    assert.deepEqual(ops(), ["maximize"]);
  });

  it("hands state pushes to subscribers once per change", () => {
    /** @type {boolean[]} */
    const seen = [];
    const stop = host.subscribe((h) => seen.push(h.maximized));
    const push = /** @type {any} */ (globalThis).__desktopWindowState;
    push(16);
    push(16);
    push(17);
    stop();
    push(16);
    assert.deepEqual(seen, [false, true]);
  });

  it("carries the controls to the shell", () => {
    calls.length = 0;
    host.minimize();
    host.toggleMaximize();
    host.close();
    assert.deepEqual(ops(), ["minimize", "maximize", "close"]);
  });
});
