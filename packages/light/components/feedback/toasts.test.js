import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { toasts } from "./toasts.js";

const sleep = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("toasts", () => {
  afterEach(() => toasts.hideAll());

  it("queues an entry and answers its id", () => {
    const id = toasts.show({ message: "saved" });
    assert.equal(toasts.items.value.length, 1);
    assert.equal(toasts.items.value[0].id, id);
    assert.equal(toasts.items.value[0].message, "saved");
  });

  it("holds an error longer than the rest, and lets the caller say otherwise", () => {
    toasts.error("boom");
    toasts.success("fine");
    toasts.show({ message: "brief", duration: 25 });
    assert.deepEqual(toasts.items.value.map((t) => t.duration), [5000, 3000, 25]);
    assert.deepEqual(toasts.items.value.map((t) => t.variant), ["error", "success", "default"]);
  });

  it("takes an entry off when its time is up", async () => {
    toasts.show({ message: "brief", duration: 10 });
    assert.equal(toasts.items.value.length, 1);
    await sleep(60);
    assert.equal(toasts.items.value.length, 0);
  });

  it("keeps an entry with no duration until something hides it", async () => {
    const id = toasts.show({ message: "sticky", duration: 0 });
    await sleep(30);
    assert.equal(toasts.items.value.length, 1);
    toasts.hide(id);
    assert.equal(toasts.items.value.length, 0);
  });

  it("a tap takes the entry off and runs what it was shown with", () => {
    let opened = 0;
    const id = toasts.show({ title: "Ana asked to join", icon: "user-round-plus", onTap: () => { opened += 1; } });
    const plain = toasts.show({ message: "saved" });
    assert.equal(toasts.items.value[0].icon, "user-round-plus");
    assert.equal(toasts.items.value[1].icon, "", "no icon asked for draws the variant's");
    assert.equal("onTap" in toasts.items.value[1], false);

    toasts.tap(id);
    assert.equal(opened, 1);
    assert.deepEqual(toasts.items.value.map((t) => t.id), [plain]);

    toasts.tap(plain);
    assert.deepEqual(toasts.items.value, [], "an entry with nothing to run is only taken off");
  });

  it("hideAll empties the queue", () => {
    toasts.info("one");
    toasts.warning("two");
    assert.equal(toasts.items.value.length, 2);
    toasts.hideAll();
    assert.deepEqual(toasts.items.value, []);
  });
});
