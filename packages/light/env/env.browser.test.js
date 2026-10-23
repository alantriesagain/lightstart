import assert from "node:assert/strict";
import { test } from "node:test";
import { BREAKPOINTS, env } from "@bootstrapp/light/env";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test("the viewport reads are current and the breakpoint follows the width", () => {
  assert.equal(env.width, globalThis.innerWidth);
  assert.equal(env.isMobile, env.width < BREAKPOINTS.md);
  assert.equal(env.snapshot().breakpoint, env.breakpoint);
});

test("a subscriber hears the dark class change, and nothing for other classes", async () => {
  document.documentElement.classList.remove("dark");
  /** @type {boolean[]} */
  const seen = [];
  const stop = env.subscribe((snapshot) => seen.push(snapshot.dark));
  try {
    document.documentElement.classList.add("dark");
    await flush();
    assert.deepEqual(seen, [true]);
    document.documentElement.classList.add("other");
    await flush();
    assert.deepEqual(seen, [true]);
  } finally {
    stop();
    document.documentElement.classList.remove("dark", "other");
  }
});
