import { defineApp } from "@lightstart/app";

export default defineApp({
  name: "fixture-worker",
  host: "web",
  stores: {
    archive: { worker: true },
  },
});
