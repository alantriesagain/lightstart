/**
 * @file A worker entry for the port case: it waits for one message carrying a
 * port, and serves the app's stores and its own worker part on that port.
 */

import { serveModels } from "@lightstart/app/web/worker-entry";
import app from "../src/app.js";
import archive from "../src/models/archive.js";
import note from "../src/models/note.js";
import worker from "../src/worker.js";

self.addEventListener(
  "message",
  (event) => {
    serveModels({ app, models: { archive, note }, worker, port: event.data });
  },
  { once: true },
);
