/**
 * @file The app: the web host, the `list` argument (`?list=Work` in the URL) naming the list to
 * open first, and two stores, `main` (IndexedDB, the web host's default) for the lists and their
 * tasks, and `activity` in memory for what this page did, gone when it closes.
 */
import { defineApp } from "@lightstart/app";

export default defineApp({
  name: "tasks",
  host: "web",
  args: {
    list: { default: "Inbox", description: "The list to open first, by its name" },
  },
  stores: {
    activity: { kind: "memory" },
  },
});
