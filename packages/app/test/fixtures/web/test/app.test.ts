import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openApp } from "@lightstart/app/test";
import manifest from "../.light/app.ts";
import notes from "../src/controllers/notes.ts";
import note from "../src/models/note.ts";

describe("openApp", () => {
  it("adds a note through the controller and reads it back", async () => {
    const app = await openApp(manifest);
    try {
      await notes.add("first");
      const rows = await note.getAll({ order: "text" });
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.text, "first");
      await notes.rows.refresh();
      assert.equal(notes.rows.value.length, 1);
      assert.equal(notes.rows.value[0]?.text, "first");
    } finally {
      await app.stop();
    }
  });
});
