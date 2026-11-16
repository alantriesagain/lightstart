// node-only
/**
 * @file A terminal app's arguments: `openApp` parses `--greeting`, fills the
 * app's defaults, rejects an unknown flag, and `restart` writes new values
 * after disposing and starting the controllers again.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { openApp } from "../test/index.ts";
import type { AppManifest } from "../manifest.ts";
import app from "./fixtures/tui/src/app.ts";
import note from "./fixtures/tui/src/models/note.ts";
import profile from "./fixtures/tui/src/models/profile.ts";

const calls: string[] = [];
const probe = {
  start(): void {
    calls.push("start");
  },
  dispose(): void {
    calls.push("dispose");
  },
};

const manifest: AppManifest = {
  app,
  models: [{ name: "note", model: note }, { name: "profile", model: profile }],
  controllers: [{ name: "probe", controller: probe }],
  routes: null,
  views: [],
};

const main = async (): Promise<void> => {
  const defaults = await openApp(manifest, { storage: "memory" });
  eq("the app's argument keeps its default", String(manifest.app.args?.["greeting"]), "hello");
  await defaults.stop();

  const fromArgv = await openApp(manifest, { storage: "memory", args: ["--greeting", "hi"] });
  eq("an argument on argv wins", String(manifest.app.args?.["greeting"]), "hi");
  await fromArgv.stop();

  const fromRecord = await openApp(manifest, { storage: "memory", args: { greeting: "yo" } });
  eq("a record merges over the defaults", String(manifest.app.args?.["greeting"]), "yo");
  await fromRecord.stop();

  let message = "";
  let threw = false;
  try {
    await openApp(manifest, { storage: "memory", args: ["--nope"] });
  } catch (error) {
    threw = true;
    message = error instanceof Error ? error.message : String(error);
  }
  ok("an unknown flag is an argument error", threw && message.includes("Unknown option: --nope"));

  calls.length = 0;
  const opened = await openApp(manifest, { storage: "memory", args: ["--greeting", "hi"] });
  await opened.restart({ greeting: "bye" });
  eq("restart writes the new argument", String(manifest.app.args?.["greeting"]), "bye");
  eq("restart disposes and starts the controllers", calls.join(","), "start,dispose,start");
  await opened.stop();
  done();
};

await main();
