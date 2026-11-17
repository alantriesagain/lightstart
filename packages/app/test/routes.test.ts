/**
 * @file Routes without a page: a run follows them over a history in memory,
 * `currentView` is the tag the path answers, `navigate` goes to another path,
 * and a stopped run shows no view and follows them no more. It runs under scriptc too: the
 * router's core and its memory history compile for a terminal app.
 */

import { done, eq } from "@lightstart/test/assert.ts";
import { defineApp } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { currentView, navigate } from "../run.ts";
import { openApp } from "../test/index.ts";

const manifest: AppManifest = {
  app: defineApp({ name: "routes", host: "tui" }),
  models: [],
  controllers: [],
  routes: {
    "/": { name: "home", title: "Home", view: "app-home" },
    "/about": { name: "about", title: "About", view: "app-about" },
  },
  views: [],
};

const main = async (): Promise<void> => {
  const opened = await openApp(manifest);
  eq("the first path's view", String(currentView.value), "app-home");
  navigate("/about");
  eq("navigate goes to another path's view", String(currentView.value), "app-about");
  await opened.stop();
  navigate("/");
  eq("a stopped run follows no routes", String(currentView.value), "null");
  done();
};

await main();
