import { defineApp } from "@lightstart/app";

export default defineApp({
  name: "fixture-worker",
  host: "web",
  worker: true,
  stores: {
    archive: {},
  },
});
