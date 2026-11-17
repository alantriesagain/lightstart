/**
 * @file The app: a terminal host, the `--list` flag naming the list to open first, and two stores,
 * `main` (JSON Lines files under `--data`, the host's default) for the lists and their tasks, and
 * `activity` in memory for what this run did, gone when it ends.
 */
import { defineApp } from "@lightstart/app";

export default defineApp({
  name: "tasks",
  host: "tui",
  args: {
    list: { default: "Inbox", description: "The list to open first, by its name" },
  },
  stores: {
    activity: { kind: "memory" },
  },
});
