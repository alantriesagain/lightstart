/**
 * @file Routes on a terminal: a root view writing `<app-container>` shows the
 * view the path answers, its path's parameters set as props, and `navigate`
 * puts the next one in its place (the same element, a parameter changed). It
 * runs under scriptc too.
 */

import { done, ok } from "@lightstart/test/assert.ts";
import { View, define, html } from "@lightstart/light/native/tui";
import { defineApp } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { openApp } from "../test/index.ts";
import { navigate } from "../tui/index.ts";
import { mountApp } from "../tui/test.ts";

class Home extends View {
  override render(): unknown {
    return html`<p>the home view</p>`;
  }
}

class About extends View {
  override render(): unknown {
    return html`<p>the about view</p>`;
  }
}

class Note extends View {
  id = this.prop<string>("id", "");

  override render(): unknown {
    return html`<p>note ${this.id.value}</p>`;
  }
}

class Root extends View {
  override render(): unknown {
    return html`<div><p>routes</p><app-container></app-container></div>`;
  }
}

define("route-home", Home);
define("route-about", About);
define("route-note", Note);

const manifest: AppManifest = {
  app: defineApp({ name: "tui-routes", host: "tui" }),
  rootView: Root,
  models: [],
  controllers: [],
  routes: {
    "/": { name: "home", view: "route-home" },
    "/about": { name: "about", view: "route-about" },
    "/notes/:id": { name: "note", view: "route-note" },
  },
  views: [],
};

const main = async (): Promise<void> => {
  const opened = await openApp(manifest);
  const mounted = mountApp(manifest, opened, { cols: 30, rows: 6 });
  try {
    await mounted.settle();
    ok("the container shows the first path's view", mounted.text().includes("the home view"));
    navigate("/about");
    await mounted.settle();
    ok("navigate puts the next view in its place", mounted.text().includes("the about view") && !mounted.text().includes("the home view"));
    navigate("/notes/7");
    await mounted.settle();
    ok("the path's parameters reach the view as props", mounted.text().includes("note 7"));
    navigate("/notes/8");
    await mounted.settle();
    ok("a parameter that changes reaches the same view", mounted.text().includes("note 8"));
  } finally {
    mounted.stop();
    await opened.stop();
  }
  done();
};

await main();
