import { defineApp } from "@lightstart/app";

export default defineApp({
  name: "fixture-tui",
  host: "tui",
  root: "app-root",
  args: {
    greeting: { default: "hello", description: "The greeting the app prints" },
  },
  stores: {
    user: { at: (args) => `${args.string("data") ?? "."}/user` },
  },
});
