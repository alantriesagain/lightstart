/**
 * @bootstrapp/light/navigation: the router interface components use.
 */

export interface Navigation {
  /** The URL an internal path is served at (a base path, a locale prefix). */
  href(path: string): string;
  /** Navigate to an internal path. */
  go(path: string): void;
  /** Hand a link click to the router; true when it navigated, so the browser must not. */
  click(event: MouseEvent, options?: { external?: boolean }): boolean;
  /** The current route path. */
  path(): string;
  /** Called after every route change. */
  subscribe(fn: () => void): () => void;
}

export * from "./index.js";
export { default } from "./index.js";
