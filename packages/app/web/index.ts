/// <reference lib="dom" />
/**
 * @file `@lightstart/app/web`: the web host. It opens the manifest's store,
 * names and starts its controllers, applies the theme preset, builds the
 * router when the project has routes, and mounts the root view in the page.
 * The views were imported by the generated manifest, so every tag exists
 * before the root view is made.
 */

import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { signal } from "@lightstart/light/signals";
import { configureNavigation } from "@lightstart/light/navigation";
import { applyTheme } from "@lightstart/light/theme";
import { loadPreset } from "@lightstart/light/theme/presets.js";
import { createBrowserAdapter, createRouter } from "@lightstart/router";
import type { RouterCore } from "@lightstart/router";
import type { AppConfig } from "../index.ts";
import { hasAdapter, registerStorageAdapter } from "@lightstart/light/model/adapter";
import IndexedDBAdapter from "@lightstart/light/model/indexeddb";
import { openStore } from "../storage.ts";
import { startControllers, stopControllers } from "../controllers.ts";
import type { AppManifest } from "../manifest.ts";

/** A running app: `stop()` disposes its controllers, stops following the router and closes its store. */
export interface AppHandle {
  stop(): Promise<void>;
}

/** The tag the router currently answers, or null when the app has no routes or no view for the path. */
export const currentView = signal<string | null>(null);

const viewOf = (route: unknown): string | null => {
  if (typeof route !== "object" || route === null) return null;
  const view = (route as { view?: unknown }).view;
  return typeof view === "string" ? view : null;
};

class AppOutlet extends View {
  render(): unknown {
    const tag = currentView.value;
    return tag === null ? html`` : html`${document.createElement(tag)}`;
  }
}

let registered = false;

const registerOutlet = (): void => {
  if (registered) return;
  View.register("app-outlet", AppOutlet);
  registered = true;
};

const applyAppTheme = async (app: AppConfig): Promise<void> => {
  const theme = await loadPreset(app.theme ?? "default");
  if (theme !== null) applyTheme(theme);
};

const mount = (tag: string): void => {
  const placeholder = document.querySelector(tag);
  if (placeholder === null) {
    document.body.append(document.createElement(tag));
    return;
  }
  if (placeholder.tagName.toLowerCase() === tag.toLowerCase()) return;
  placeholder.replaceWith(document.createElement(tag));
};

/** Start the app on the web; answers the handle that stops it. */
export const start = async (manifest: AppManifest): Promise<AppHandle> => {
  registerOutlet();
  currentView.value = null;
  if (!hasAdapter("indexeddb")) registerStorageAdapter("indexeddb", IndexedDBAdapter);
  const store = await openStore(manifest);
  const controllers = await startControllers(manifest);
  await applyAppTheme(manifest.app);

  let router: RouterCore | null = null;
  let following: (() => void) | null = null;
  if (manifest.routes !== null) {
    router = createRouter(createBrowserAdapter(), {
      routes: manifest.routes,
      appName: manifest.app.name,
      onRouteChange: (matched) => {
        currentView.value = viewOf(matched.route);
      },
    });
    configureNavigation(router.navigation);
    following = router.subscribe((matched) => {
      currentView.value = viewOf(matched.route);
    });
    currentView.value = router.currentRoute === null ? null : viewOf(router.currentRoute.route);
  }

  mount(manifest.app.root ?? "app-root");

  return {
    async stop(): Promise<void> {
      if (following !== null) following();
      await stopControllers(controllers);
      await store.close();
    },
  };
};
