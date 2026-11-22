// node-only
/**
 * @file The run starts a `Controller` subclass with its `start()`, and only
 * reaches a `defineController` literal: a member the literal declares, an
 * action named `start` included, is the app's and the run never calls it.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { defineController } from "@lightstart/light/controller";
import { Controller } from "@lightstart/light/controller/class";
import { defineApp } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { openApp } from "../test/index.ts";

const calls: string[] = [];

const challenges = defineController({
  name: "challenges",
  start(draft?: { title: string }) {
    calls.push(`challenges.start(${draft === undefined ? "nothing" : draft.title})`);
  },
});

class Clock extends Controller {
  constructor() {
    super("clock");
  }

  override connected(): Promise<void> | null {
    calls.push("clock.connected");
    return null;
  }
}

const clock = new Clock();

const manifest: AppManifest = {
  app: defineApp({ name: "controller-start", host: "web" }),
  models: [],
  controllers: [
    { name: "challenges", controller: challenges },
    { name: "clock", controller: clock },
  ],
  routes: null,
  views: [],
};

const main = async (): Promise<void> => {
  const opened = await openApp(manifest);
  ok("a literal's own start action is never called by the run", !calls.some((call) => call.startsWith("challenges.start")));
  ok("a Controller subclass is started", calls.includes("clock.connected"));
  challenges.start({ title: "30 days" });
  eq("the action still answers the app", calls.filter((call) => call.startsWith("challenges.start")).join(","), "challenges.start(30 days)");
  await opened.stop();
  done();
};

await main();
