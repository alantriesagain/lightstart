/**
 * @file The worker fixture in the page: a write to each store reads back, the
 * archive model's hook runs in the worker, its seed lands once, the page
 * follows a write through the worker, the page stays responsive during a
 * large write, a validation failure reaches the page with its name and
 * fields, and a store of an adapter type the worker lacks rejects the run
 * naming the adapter types the worker runs (the page names an adapter type so
 * the run is not memory-only, and the worker opens its stores as declared).
 * The project's own worker part serves its requests, relays its events and
 * mirrors its signal, and a factory answering a `MessagePort` serves the same
 * channel.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AdapterType } from "@lightstart/app/stores.ts";
import { openPage } from "@lightstart/app/web/test";
import { worker, WorkerStores } from "@lightstart/app/web/worker.ts";
import manifest from "../.light/app.js";
import { archived, lastArchived } from "../src/shared.js";

const inWorker = () => new WorkerStores(() => new Worker(new URL("../.light/worker.js", import.meta.url), { type: "module" }));
const inBadWorker = () => new WorkerStores(() => new Worker(new URL("./bad-worker.js", import.meta.url), { type: "module" }));

const received = [];
archived.on((row) => received.push(row));
worker.serve({ "page.hello": (payload) => `hello from the page for ${payload.from}` });
worker.relay({ archived });
worker.mirror("lastArchived", lastArchived, { owner: false });

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

class CustomAdapterType extends AdapterType {
  name = "custom";

  open() {
    return Promise.reject(new Error("the page never opens it"));
  }
}

describe("worker stores", () => {
  it("writes to each store, runs hooks in the worker, follows the worker's rows and stays responsive", async () => {
    const archive = modelNamed("archive");
    const note = modelNamed("note");
    const page = await openPage(manifest, { stores: inWorker() });
    try {
      const wroteNote = await note.add({ text: "page write" });
      assert.equal((await note.get(wroteNote.id)).text, "page write", "a write to the main store reads back");

      const wroteArchive = await archive.add({ text: "worker write" });
      assert.equal((await archive.get(wroteArchive.id)).text, "worker write", "a write to the archive store reads back");
      assert.equal(wroteArchive.ranInWorker, true, "the model hook ran in the worker");
      assert.equal(await archive.count({ where: { text: "Archived note" } }), 1, "the worker seed is present once");
      const seeded = await archive.getAll({ where: { text: "Archived note" } });
      assert.equal(seeded[0].ranInWorker, true, "the seed ran through the worker's hook too");

      const controller = page.run.controllers[0];
      const before = controller.rows.value.length;
      await archive.add({ text: "late note" });
      await waitFor(() => controller.rows.value.length === before + 1, "the controller's rows to follow the worker write");
      assert.ok(controller.rows.value.some((row) => row.text === "late note"), "the page's live rows follow a worker write");
      controller.rows.dispose();

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

  it("serves the worker's own requests, relays its event and follows its mirrored signal", async () => {
    const archive = modelNamed("archive");
    const page = await openPage(manifest, { stores: inWorker() });
    try {
      assert.equal(await worker.request("archive.total"), await archive.count(), "the worker's handler reaches its own store");
      const before = received.length;
      await archive.add({ text: "crossing the channel" });
      await waitFor(() => received.length > before, "the worker's archived event");
      const row = received[received.length - 1];
      assert.equal(row.text, "crossing the channel", "the relayed event carries the row");
      await waitFor(() => lastArchived.value === "crossing the channel", "the mirrored signal");
      assert.equal(await worker.request("worker.greeting"), "hello from the page for worker", "the worker read the page's answer");
      assert.equal(await worker.request("worker.later"), "served after open", "a handler opened serves after the stores open answers");
    } finally {
      await page.stop();
      lastArchived.value = null;
    }
  });

  it("takes a MessagePort from the factory and serves the same channel", async () => {
    const archive = modelNamed("archive");
    const spawned = new Worker(new URL("./port-worker.js", import.meta.url), { type: "module" });
    const channel = new MessageChannel();
    spawned.postMessage(channel.port2, [channel.port2]);
    const page = await openPage(manifest, { stores: new WorkerStores(() => channel.port1) });
    try {
      assert.equal(await worker.request("archive.total"), await archive.count(), "the port answers the worker's own request");
      assert.equal(await worker.request("worker.greeting"), "hello from the page for worker", "the port answers the worker's greeting");
    } finally {
      await page.stop();
      spawned.terminate();
    }
  });

  it("reaches the page with a validation error's name and fields", async () => {
    const note = modelNamed("note");
    const page = await openPage(manifest, { stores: inWorker() });
    try {
      let caught = null;
      try {
        await note.add({});
        assert.fail("a missing required field should reject");
      } catch (error) {
        caught = error;
      }
      assert.equal(caught.name, "ValidationError");
      assert.ok(caught.errors !== undefined && typeof caught.errors.text === "string", `the error carries its fields: ${String(caught.errors)}`);
    } finally {
      await page.stop();
    }
  });

  it("rejects the run when the worker cannot run a store's adapter type", async () => {
    let message = "";
    try {
      await openPage(manifest, { adapters: [new CustomAdapterType()], stores: inBadWorker() });
      assert.fail("a worker store of an adapter type the worker lacks should reject");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assert.ok(message.includes("custom"), `the rejection names the adapter type: ${message}`);
    assert.ok(message.includes("indexeddb") && message.includes("memory"), `the rejection names the worker's adapter types: ${message}`);
  });
});
