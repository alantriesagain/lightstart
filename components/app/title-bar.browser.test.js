/**
 * `<lc-title-bar>` inside a desktop shell's window: with a window host on the
 * page it drives the window (buttons, drag, double-click) unless a listener
 * takes over, follows the maximized state, hides its controls where the system
 * keeps its own, and hides itself in a window that keeps the system title bar.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import View from "@bootstrapp/light";
import titleBarDef from "@bootstrapp/light/components/app/title-bar.js";

if (!customElements.get("lc-title-bar")) View.define("lc-title-bar", titleBarDef);

const rendered = (el) => el.$requestUpdate() ?? Promise.resolve();

/** @param {Record<string, unknown>} [overrides] */
const stubHost = (overrides = {}) => {
  /** @type {string[]} */
  const calls = [];
  /** @type {Set<(host: any) => void>} */
  const listeners = new Set();
  const host = {
    platform: "linux",
    frameless: true,
    nativeControls: false,
    controlsInset: 0,
    maximized: false,
    fullscreen: false,
    focused: true,
    minimized: false,
    minimize: () => calls.push("minimize"),
    toggleMaximize: () => calls.push("maximize"),
    close: () => calls.push("close"),
    startDrag: () => calls.push("drag"),
    dragFrom: () => calls.push("dragFrom"),
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    ...overrides,
  };
  /** @param {Record<string, unknown>} change */
  const set = (change) => {
    Object.assign(host, change);
    for (const fn of listeners) fn(host);
  };
  /** @type {any} */ (globalThis).__desktopWindow = host;
  return { host, calls, set };
};

/** @param {string} [inner] */
const mount = async (inner = "") => {
  /** @type {any} */
  const el = document.createElement("lc-title-bar");
  el.title = "App";
  el.innerHTML = inner;
  document.body.appendChild(el);
  await rendered(el);
  return el;
};

/** @param {Element} target */
const press = (target, detail = 1) => target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, detail }));

describe("lc-title-bar in a frameless desktop window", () => {
  afterEach(() => {
    delete (/** @type {any} */ (globalThis)).__desktopWindow;
    for (const el of document.querySelectorAll("lc-title-bar")) el.remove();
  });

  it("drives the window from its buttons", async () => {
    const { calls } = stubHost();
    const el = await mount();
    el.querySelector("[part~=lc-title-bar-minimize]").click();
    el.querySelector("[part~=lc-title-bar-maximize]").click();
    el.querySelector("[part~=lc-title-bar-close]").click();
    assert.deepEqual(calls, ["minimize", "maximize", "close"]);
    assert.equal(el.dataset.host, "frameless");
    assert.equal(el.dataset.platform, "linux");
  });

  it("lets a listener take over a button with preventDefault", async () => {
    const { calls } = stubHost();
    const el = await mount();
    let heard = 0;
    el.addEventListener("close", (/** @type {Event} */ e) => {
      heard++;
      e.preventDefault();
    });
    el.querySelector("[part~=lc-title-bar-close]").click();
    assert.equal(heard, 1);
    assert.deepEqual(calls, []);
  });

  it("hands a press on the bar to the window, but not a press on a slotted button", async () => {
    const { calls } = stubHost();
    const el = await mount(`<div slot="left"><button id="menu">File</button></div>`);
    press(el.querySelector("[part~=lc-title-bar-titlebar]"));
    press(el.querySelector("#menu"));
    assert.deepEqual(calls, ["dragFrom"]);
    el.draggable = false;
    await rendered(el);
    press(el.querySelector("[part~=lc-title-bar-titlebar]"));
    assert.deepEqual(calls, ["dragFrom"]);
  });

  it("follows the maximized state: the maximize button becomes restore", async () => {
    const { set } = stubHost();
    const el = await mount();
    const label = () => el.querySelector("[part~=lc-title-bar-maximize]").getAttribute("aria-label");
    const before = label();
    set({ maximized: true });
    await rendered(el);
    assert.equal(el.maximized, true);
    assert.notEqual(label(), before);
    set({ maximized: false, focused: false });
    await rendered(el);
    assert.equal(label(), before);
    assert.ok(el.hasAttribute("data-inactive"));
  });

  it("leaves the system's traffic lights alone on macOS and reserves their room", async () => {
    stubHost({ platform: "macos", nativeControls: true, controlsInset: 78 });
    const el = await mount();
    assert.equal(el.querySelector("[part~=lc-title-bar-controls]"), null);
    assert.equal(el.dataset.platform, "mac");
    assert.ok(el.hasAttribute("data-native-controls"));
    assert.equal(el.style.getPropertyValue("--lc-title-bar-inset"), "78px");
  });

  it("hides itself in a window that keeps the system title bar", async () => {
    stubHost({ platform: "windows", frameless: false });
    const el = await mount();
    assert.equal(el.dataset.host, "native");
    assert.equal(el.querySelector("[part~=lc-title-bar-controls]"), null);
  });
});

describe("lc-title-bar in a browser", () => {
  it("only emits, and draws its controls", async () => {
    const el = await mount();
    let heard = 0;
    el.addEventListener("minimize", () => heard++);
    el.querySelector("[part~=lc-title-bar-minimize]").click();
    assert.equal(heard, 1);
    assert.equal(el.dataset.host, undefined);
    el.remove();
  });
});
