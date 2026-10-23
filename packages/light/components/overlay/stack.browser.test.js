import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { overlays } from "./stack.js";

const escape = () =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

const host = () => document.createElement("div");
const locked = () => document.body.style.overflow === "hidden";

describe("overlays", () => {
  afterEach(() => {
    overlays.stack.value = [];
    document.body.style.overflow = "";
  });

  it("keeps the body locked while any locking layer is still open", () => {
    const stack = overlays;
    const first = stack.open(host(), { lockScroll: true });
    const second = stack.open(host(), { lockScroll: true });
    assert.equal(locked(), true);

    stack.close(second);
    assert.equal(locked(), true, "the first layer is still open");

    stack.close(first);
    assert.equal(locked(), false);
  });

  it("gives Escape to the topmost layer and no other", () => {
    const stack = overlays;
    const reached = [];
    stack.open(host(), { dismiss: () => reached.push("under") });
    const top = stack.open(host(), { dismiss: () => reached.push("top") });

    escape();
    assert.deepEqual(reached, ["top"]);

    stack.close(top);
    escape();
    assert.deepEqual(reached, ["top", "under"]);
  });

  it("passes Escape by a layer that does not answer one", () => {
    const stack = overlays;
    const reached = [];
    stack.open(host(), { dismiss: () => reached.push("under") });
    stack.open(host(), { dismissible: false, dismiss: () => reached.push("native") });

    escape();
    assert.deepEqual(reached, [], "a native dialog answers its own Escape, and shields what is below");
  });

  it("returns focus to whatever opened the layer", () => {
    const stack = overlays;
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    assert.equal(document.activeElement, opener);

    const id = stack.open(host());
    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    elsewhere.focus();

    stack.close(id);
    assert.equal(document.activeElement, opener);
    opener.remove();
    elsewhere.remove();
  });

  it("answers which layer is on top", () => {
    const stack = overlays;
    const first = stack.open(host());
    const second = stack.open(host());
    assert.equal(stack.isTop(second), true);
    assert.equal(stack.isTop(first), false);
    stack.closeTop();
    assert.equal(stack.isTop(first), true);
  });
});
