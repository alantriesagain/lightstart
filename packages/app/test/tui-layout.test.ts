/**
 * @file Routes with layouts on a terminal: the app default layout wraps a
 * top-level route, a route with its own view holds an `<app-container>` for
 * its children, and `layout: null` opts out. It runs under scriptc too.
 */

import { done, ok } from "@lightstart/test/assert.ts";
import { View, define, html } from "@lightstart/light/native/tui";
import { defineApp } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { openApp } from "../test/index.ts";
import { navigate } from "../tui/index.ts";
import { mountApp } from "../tui/test.ts";

class Shell extends View {
  override render(): unknown {
    return html`<div><p>shell</p><app-container></app-container></div>`;
  }
}

class Home extends View {
  override render(): unknown {
    return html`<p>home</p>`;
  }
}

class Plain extends View {
  override render(): unknown {
    return html`<p>plain</p>`;
  }
}

class Settings extends View {
  override render(): unknown {
    return html`<div><p>settings</p><app-container></app-container></div>`;
  }
}

class Profile extends View {
  override render(): unknown {
    return html`<p>profile</p>`;
  }
}

class Billing extends View {
  override render(): unknown {
    return html`<p>billing</p>`;
  }
}

define("layout-shell", Shell);
define("layout-home", Home);
define("layout-plain", Plain);
define("layout-settings", Settings);
define("layout-profile", Profile);
define("layout-billing", Billing);

class Root extends View {
  override render(): unknown {
    return html`<div><app-container></app-container></div>`;
  }
}

const manifest: AppManifest = {
  app: defineApp({ name: "tui-layout", host: "tui", layout: "layout-shell" }),
  rootView: Root,
  models: [],
  controllers: [],
  routes: {
    "/": { name: "home", view: "layout-home" },
    "/plain": { name: "plain", view: "layout-plain", layout: null },
    "/settings": {
      name: "settings",
      view: "layout-settings",
      routes: {
        "/profile": { name: "profile", view: "layout-profile" },
        "/billing": { name: "billing", view: "layout-billing" },
      },
    },
  },
  views: [],
};

const main = async (): Promise<void> => {
  const opened = await openApp(manifest);
  const mounted = mountApp(manifest, opened, { cols: 30, rows: 8 });
  try {
    await mounted.settle();
    ok("the app default layout wraps a top-level view", mounted.text().includes("shell") && mounted.text().includes("home"));
    navigate("/settings/profile");
    await mounted.settle();
    ok("a routed view holds its child inside the layout", mounted.text().includes("shell") && mounted.text().includes("settings") && mounted.text().includes("profile"));
    navigate("/settings/billing");
    await mounted.settle();
    ok("a child route replaces its sibling", mounted.text().includes("billing") && !mounted.text().includes("profile"));
    navigate("/plain");
    await mounted.settle();
    ok("layout: null draws without the app's layout", mounted.text().includes("plain") && !mounted.text().includes("shell"));
  } finally {
    mounted.stop();
    await opened.stop();
  }
  done();
};

await main();
