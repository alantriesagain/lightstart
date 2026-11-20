/**
 * @file The worker fixture in the page: a write to each store reads back, the
 * page follows a write to the worker model, its seed lands once, the page
 * stays responsive during a large write, and a worker-side failure rejects the
 * run naming the kinds the worker runs.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defineApp } from "@lightstart/app";
import { StoreKind } from "@lightstart/app/stores.ts";
import { openPage } from "@lightstart/app/web/test";
import manifest from "../.light/app.js";

const spawn = () => new Worker(new URL("../.light/worker.js", import.meta.url), { type: "module" });

const modelNamed = (name) => {
  const found = manifest.models.find((entry) => entry.name === name);
  if (found === undefined) throw new Error(`the manifest has no model "${name}"`);
  return found.model;
};

const waitFor = async (check, label) => {
  const until = Date.now() + 4000;
  while (Date.now() < until) {
    if (check()) return;
    await new Promise((settle) => setTimeout(settle, 10));
  }
  throw new Error(`timed out waiting for ${label}`);
};

class CustomKind extends StoreKind {
  name = "custom";

  open() {
    return Promise.reject(new Error("the page never opens it"));
  }
}

describe("worker stores", () => {
  it("writes to each store, follows the worker's rows and stays responsive", async () => {
    const archive = modelNamed("archive");
    const note = modelNamed("note");
    const page = await openPage(manifest, { worker: spawn });
    try {
      const wroteNote = await note.add({ text: "page write" });
      assert.equal((await note.get(wroteNote.id)).text, "page write", "a write to the page store reads back");

      const wroteArchive = await archive.add({ text: "worker write" });
      assert.equal((await archive.get(wroteArchive.id)).text, "worker write", "a write to the worker store reads back");
      assert.equal(await archive.count({ where: { text: "Archived note" } }), 1, "the worker seed is present once");

      const controller = page.run.controllers[0];
      const before = controller.rows.value.length;
      await archive.add({ text: "late note" });
      await waitFor(() => controller.rows.value.length === before + 1, "the controller's rows to follow the worker write");
      assert.ok(controller.rows.value.some((row) => row.text === "late note"), "the page's live rows follow a worker write");

      let ticks = 0;
      const timer = setInterval(() => {
        ticks += 1;
      }, 10);
      const rows = Array.from({ length: 20000 }, (_, index) => ({ text: `bulk ${String(index)} ${"x".repeat(1024)}` }));
      const started = Date.now();
      await archive.addMany(rows);
      const elapsed = Date.now() - started;
      clearInterval(timer);
      assert.ok(ticks > 3, `the page stayed responsive during a large worker write (${String(ticks)} ticks in ${String(elapsed)} ms)`);
    } finally {
      await page.stop();
    }
  });

  it("rejects the run when the worker cannot run a store's kind", async () => {
    const app = defineApp({
      name: "fixture-worker-bad",
      host: "web",
      stores: { main: { kind: "memory" }, archive: { kind: "custom", worker: true } },
    });
    let message = "";
    try {
      await openPage({ ...manifest, app }, { kinds: [new CustomKind()], worker: spawn });
      assert.fail("a worker store of a kind the worker lacks should reject");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assert.ok(message.includes("custom"), `the rejection names the kind: ${message}`);
    assert.ok(message.includes("indexeddb") && message.includes("memory"), `the rejection names the worker's kinds: ${message}`);
  });
});
