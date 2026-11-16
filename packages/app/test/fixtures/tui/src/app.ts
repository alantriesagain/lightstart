import { defineApp } from "@lightstart/app";

export default defineApp({
  name: "fixture-tui",
  host: "tui",
  root: "app-root",
  args: {
    greeting: { default: "hello", description: "The greeting the app prints" },
  },
  storage: {
    kind: "jsonl",
    databases: {
      user: { kind: "jsonl", dir: (args: Record<string, unknown>) => `${String(args.data)}/user` },
    },
  },
});
