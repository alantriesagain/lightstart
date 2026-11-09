/**
 * @lightstart/router/adapters/browser: the location and history of the page,
 * through `window.location`, `window.history` and `document.title`. The
 * globals are read through structural shapes because the package compiles
 * without the DOM type library.
 */

import type { AdapterLocation, RouterAdapter } from "../contracts.ts";

interface WindowLocationLike {
  href: string;
  origin: string;
  pathname: string;
  search: string;
  hash: string;
  assign(path: string): void;
}

interface WindowHistoryLike {
  pushState(state: unknown, unused: string, path: string): void;
  replaceState(state: unknown, unused: string, path: string): void;
  back(): void;
  forward(): void;
}

interface WindowLike {
  location: WindowLocationLike;
  history: WindowHistoryLike;
}

interface DocumentLike {
  title: string;
}

const browserWindow = (): WindowLike => (globalThis as unknown as { window: WindowLike }).window;

const browserDocument = (): DocumentLike => (globalThis as unknown as { document: DocumentLike }).document;

/** A router adapter over the browser's own location and history. */
export class BrowserAdapter implements RouterAdapter {
  readonly type = "browser";

  getLocation(): AdapterLocation {
    const location = browserWindow().location;
    return {
      href: location.href,
      origin: location.origin,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    };
  }

  isSamePath(path: string): boolean {
    const location = browserWindow().location;
    return new URL(path, location.origin).href === location.href;
  }

  hardNavigate(path: string): void {
    browserWindow().location.assign(path);
  }

  pushState(state: unknown, path: string): void {
    const win = browserWindow();
    const url = new URL(path, win.location.origin);
    if (url.href !== win.location.href) win.history.pushState(state, "", path);
  }

  replaceState(state: unknown, path: string): void {
    browserWindow().history.replaceState(state, "", path);
  }

  back(): void {
    browserWindow().history.back();
  }

  forward(): void {
    browserWindow().history.forward();
  }

  setTitle(title: string): void {
    browserDocument().title = title;
  }
}

/** Create a browser adapter. */
export const createBrowserAdapter = (): RouterAdapter => new BrowserAdapter();
