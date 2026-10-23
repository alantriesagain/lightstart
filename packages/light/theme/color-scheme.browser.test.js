import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { env } from "@bootstrapp/light/env";
import { colorScheme } from "./color-scheme.js";

const KEY = "darkmode";

let prefersDark = false;
/** @type {Set<(s: { prefersDark: boolean }) => void>} */
const watchers = new Set();

const setSystem = (/** @type {boolean} */ on) => {
  prefersDark = on;
  for (const fn of [...watchers]) fn({ prefersDark: on });
};

/** @param {string} [darkMode] what the page declares */
const boot = (darkMode = "system") => {
  colorScheme.start(darkMode);
  return colorScheme;
};
const isDarkClass = () => document.documentElement.classList.contains("dark");
const real = Object.getOwnPropertyDescriptors(env);

describe("colorScheme", () => {
  before(() => {
    Object.defineProperties(env, {
      prefersDark: { get: () => prefersDark, configurable: true },
      subscribe: {
        value: (/** @type {(s: { prefersDark: boolean }) => void} */ fn) => {
          watchers.add(fn);
          return () => watchers.delete(fn);
        },
        configurable: true,
      },
    });
  });

  after(() => {
    Object.defineProperties(env, { prefersDark: real.prefersDark, subscribe: real.subscribe });
  });

  afterEach(() => {
    watchers.clear();
    localStorage.removeItem(KEY);
    document.documentElement.classList.remove("dark");
    prefersDark = false;
  });

  it("stays light for an app that never opted into a dark scheme", () => {
    setSystem(true);
    const scheme = boot("");
    assert.equal(scheme.followsSystem, false, "only darkMode:system follows the OS unasked");
    assert.equal(scheme.dark.value, false);
    assert.equal(isDarkClass(), false);
  });

  it("honours a stored choice even when the app declares no dark mode", () => {
    localStorage.setItem(KEY, "true");
    const scheme = boot("");
    assert.equal(scheme.dark.value, true);
    assert.equal(isDarkClass(), true);
  });

  it("follows the system while nothing is stored, and stores nothing", () => {
    setSystem(true);
    const scheme = boot();
    assert.equal(scheme.followsSystem, true);
    assert.equal(scheme.dark.value, true);
    assert.equal(isDarkClass(), true);
    assert.equal(localStorage.getItem(KEY), null, "following the system must not persist");
  });

  it("leaves a dark class set by hand alone when the OS has not changed", () => {
    const scheme = boot();
    document.documentElement.classList.add("dark");
    setSystem(false);
    assert.equal(isDarkClass(), true, "only a change of the OS preference re-applies");
    assert.equal(scheme.dark.value, false);
  });

  it("tracks a later OS change while it is still following", () => {
    const scheme = boot();
    assert.equal(scheme.dark.value, false);
    setSystem(true);
    assert.equal(scheme.dark.value, true);
    assert.equal(isDarkClass(), true);
    assert.equal(localStorage.getItem(KEY), null);
  });

  it("stores a choice as the literal the pre-paint script reads", () => {
    const scheme = boot();
    scheme.choose(true);
    assert.equal(localStorage.getItem(KEY), "true");
    assert.equal(scheme.followsSystem, false);
    scheme.choose(false);
    assert.equal(localStorage.getItem(KEY), "false");
    assert.equal(isDarkClass(), false);
  });

  it("lets a stored choice beat the OS on the next boot, and stops following", () => {
    boot().choose(false);

    setSystem(true);
    const next = boot();
    assert.equal(next.followsSystem, false);
    assert.equal(next.dark.value, false, "the stored choice wins");
    setSystem(false);
    setSystem(true);
    assert.equal(next.dark.value, false, "an OS change no longer moves a chosen scheme");
  });

  it("toggles from whatever is showing and records that as a choice", () => {
    setSystem(true);
    const scheme = boot();
    assert.equal(scheme.dark.value, true);
    scheme.toggle();
    assert.equal(scheme.dark.value, false);
    assert.equal(isDarkClass(), false);
    assert.equal(localStorage.getItem(KEY), "false");
  });
  it("an app that declares dark starts dark with nothing stored, and a choice of light sticks", () => {
    const scheme = boot("dark");
    assert.equal(scheme.dark.value, true);
    assert.equal(isDarkClass(), true);
    assert.equal(scheme.followsSystem, false, "dark is a default, not the OS");
    assert.equal(localStorage.getItem(KEY), null, "the default is never written");
    scheme.choose(false);
    assert.equal(isDarkClass(), false);
    assert.equal(localStorage.getItem(KEY), "false");
    assert.equal(boot("dark").dark.value, false, "the stored choice beats the default on the next boot");
  });
});
