// node-only
/**
 * @file A host's router options reach the run's router: its locales, its
 * origin and a tracker for a route change's work, beside the app's own base
 * and name, which a host cannot replace.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import type { RouterOptions } from "@lightstart/router/contracts.ts";
import { defineApp } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { openStores } from "../engine.ts";
import { AppHost, AppRun, navigate } from "../run.ts";
import type { RunStore } from "../run.ts";
import { MemoryAdapterType } from "../stores.ts";

const tracked: string[] = [];

class OptionsHost extends AppHost {
  constructor() {
    super();
    this.adapters = [new MemoryAdapterType()];
    this.defaultAdapter = "memory";
    this.openStores = (manifest: AppManifest, memoryOnly: boolean): Promise<RunStore> => openStores(manifest, this, memoryOnly);
  }

  routerOptions(): RouterOptions {
    return {
      locales: ["en", "pt-BR"],
      defaultLocale: "en",
      origin: "https://example.test",
      basePath: "/ignored",
      track: (work: Promise<unknown>, label: string) => {
        tracked.push(label);
        void work;
      },
    };
  }
}

const manifest: AppManifest = {
  app: defineApp({ name: "options", host: "web", url: "https://example.test/app" }),
  models: [],
  controllers: [],
  routes: {
    "/": { name: "home", view: "app-home" },
    "/about": { name: "about", view: "app-about" },
  },
  views: [],
};

const main = async (): Promise<void> => {
  const run = new AppRun(manifest, new OptionsHost());
  await run.start();
  const router = run.router;
  ok("the run has a router", router !== null);
  eq("the host's locales reach it", JSON.stringify(router?.options.locales), '["en","pt-BR"]');
  eq("and its origin", String(router?.options.origin), "https://example.test");
  eq("the app's base is the run's, not the host's", String(router?.options.basePath), "/app");
  navigate("/about");
  await new Promise((resolve) => setTimeout(resolve, 0));
  ok("a route change's work is tracked through the host's tracker", tracked.some((label) => label.includes("/about")));
  await run.stop();
  done();
};

await main();
