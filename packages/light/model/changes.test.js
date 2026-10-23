import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { modelBus } from "./config.ts";
import { MODEL_CHANGED, MODEL_ERROR } from "./events.ts";
import { onChange } from "./changes.ts";

const events = modelBus();

const change = (model, action, row) => events.emit(MODEL_CHANGED, { model, action, row });

describe("onChange", () => {
  it("delivers adds and edits that match the where, every removal, and nothing after unsubscribing", async () => {
    const seen = [];
    const off = onChange("post", { status: "live" }, (event) => seen.push(`${event.action}:${event.row.id}`));
    await change("post", "add", { id: 1, status: "live" });
    await change("post", "add", { id: 2, status: "draft" });
    await change("post", "edit", { id: 3, status: "live" });
    await change("post", "remove", { id: 4, status: "draft" });
    await change("comment", "add", { id: 5, status: "live" });
    off();
    await change("post", "add", { id: 6, status: "live" });
    assert.deepEqual(seen, ["add:1", "edit:3", "remove:4"]);
  });

  it("an undefined where hears every change; a throwing callback is reported, not fatal", async () => {
    const seen = [];
    const errors = [];
    const offError = events.on(MODEL_ERROR, (data) => errors.push(data.type));
    const offAll = onChange("post", undefined, (event) => seen.push(event.row.id));
    const offBad = onChange("post", undefined, () => { throw new Error("boom"); });
    await change("post", "edit", { id: 9 });
    assert.deepEqual(seen, [9]);
    assert.deepEqual(errors, ["change_callback_failed"]);
    offAll();
    offBad();
    offError();
  });

  it("a sync carries no row and reaches every subscriber, with a where or without", async () => {
    const seen = [];
    const off = onChange("post", { status: "live" }, (event) => seen.push(event.action));
    const offAll = onChange("post", undefined, (event) => seen.push(`all:${event.action}`));
    await events.emit(MODEL_CHANGED, { model: "post", action: "sync" });
    assert.deepEqual(seen, ["sync", "all:sync"]);
    off();
    offAll();
  });
});
