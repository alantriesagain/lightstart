/**
 * This app's own type surface. The catalogue keeps no models: what it draws
 * comes from `@bootstrapp/light` (the component registry and each component's
 * demo), so only the shapes the app computes are declared here.
 */

import type { TypeDefinition } from "@bootstrapp/light/types";

/**
 * The declared type of a reactive property. `T.array()`/`T.object()` alone
 * infer `unknown[]`/`unknown`, so a view that renders rows says what they are
 * by casting the descriptor.
 */
export type Prop<V> = TypeDefinition<V>;

/** One skin the header offers: a preset and the two colours its swatch shows. */
export type SkinOption = {
  name: string;
  label: string;
  description: string;
  primary: string;
  canvas: string;
};
