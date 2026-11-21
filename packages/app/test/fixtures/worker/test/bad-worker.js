/**
 * @file A worker entry for an app whose archive store names an adapter type
 * the worker does not run, so opening its stores rejects.
 */

import { defineApp } from "@lightstart/app";
import { serveModels } from "@lightstart/app/web/worker-entry";
import archive from "../src/models/archive.js";
import note from "../src/models/note.js";

serveModels({
  app: defineApp({
    name: "fixture-worker-bad",
    host: "web",
    worker: true,
    stores: { main: { adapter: "memory" }, archive: { adapter: "custom" } },
  }),
  models: { archive, note },
});
