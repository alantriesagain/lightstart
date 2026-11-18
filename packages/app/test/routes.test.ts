/**
 * @file Routes without a page: a run follows them over a history in memory,
 * `currentView` is the tag the path answers and `currentParams` its path's
 * parameters, `navigate` goes to another path,
 * and a stopped run shows no view and follows them no more. It runs under scriptc too: the
 * router's core and its memory history compile for a terminal app.
 */

import { done, eq } from "@lightstart/test/assert.ts";
import { defineApp } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { currentParams, currentView, navigate } from "../run.ts";
import { openApp } from "../test/index.ts";

const manifest: AppManifest = {
  app: defineApp({ name: "routes", host: "tui" }),
  models: [],
  controllers: [],
  routes: {
    "/": { name: "home", title: "Home", view: "app-home" },
    "/about": { name: "about", title: "About", view: "app-about" },
    "/notes/:id": { name: "note", title: "Note", view: "app-note" },
  },
  views: [],
};

const main = async (): Promise<void> => {
  const opened = await openApp(manifest);
  eq("the first path's view", String(currentView.value), "app-home");
  navigate("/about");
  eq("navigate goes to another path's view", String(currentView.value), "app-about");
  eq("a path without parameters has none", JSON.stringify(currentParams.value), "{}");
  navigate("/notes/7");
  eq("a path's parameters come with its view", String(currentView.value) + " " + JSON.stringify(currentParams.value), 'app-note {"id":"7"}');
  await opened.stop();
  navigate("/");
  eq("a stopped run follows no routes", String(currentView.value) + " " + JSON.stringify(currentParams.value), "null {}");
  done();
};

await main();
