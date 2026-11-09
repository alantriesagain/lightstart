/**
 * @lightstart/router/navigation: the router as light's `Navigation`
 * contract sees it, for `configureNavigation(router.navigation)`.
 */

import type { ClickEvent } from "./click.ts";
import type { RouterCore } from "./core.ts";

/** Adapts a router to light's `Navigation` contract. */
export class NavigationBridge {
  private readonly router: RouterCore;

  constructor(router: RouterCore) {
    this.router = router;
  }

  href(path: string): string {
    return this.router.href(path);
  }

  go(path: string): void {
    this.router.go(path);
  }

  click(event: ClickEvent, options?: { external?: boolean }): boolean {
    return this.router.click(event, options);
  }

  path(): string {
    return this.router.routePath;
  }

  subscribe(fn: () => void): () => void {
    return this.router.subscribe((): void => fn());
  }
}
