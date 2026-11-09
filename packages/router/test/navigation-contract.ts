/**
 * @file The type-level contract: `router.navigation` is assignable to light's `Navigation`, the
 * shape `configureNavigation` takes. Checked by `light-native typecheck`; it runs nothing.
 */
import type { Navigation } from "@lightstart/light/navigation";
import { createMemoryRouter } from "../app.ts";

/** The router's navigation bridge as light's `Navigation`. */
export const navigationContract: Navigation = createMemoryRouter({
  routes: { "/": { name: "home" } },
}).navigation;
