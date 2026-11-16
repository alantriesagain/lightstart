/**
 * @file What a terminal host reads from the root view it made: `onKey`, the
 * app's own keys, and `mounted`, called once the renderer runs it so the view
 * can reach the renderer and its terminal (focus, size, title, the screen's
 * text). Both are optional, and the test host reads them the same way.
 */

import type { KeyEvent, Renderer } from "@lightstart/light/native/tui";

/** The root view's `onKey`, when it has one. */
export const handlerOf = (value: unknown): ((renderer: Renderer, e: KeyEvent) => boolean) | null => {
  if (typeof value !== "object" || value === null) return null;
  const handler = (value as Record<string, unknown>)["onKey"];
  return typeof handler === "function" ? (handler as (renderer: Renderer, e: KeyEvent) => boolean) : null;
};

/** Call the root view's `mounted(renderer)`, when it has one. */
export const callMounted = (root: unknown, renderer: Renderer): void => {
  if (typeof root !== "object" || root === null) return;
  const mounted = (root as Record<string, unknown>)["mounted"];
  if (typeof mounted === "function") (mounted as (renderer: Renderer) => void).call(root, renderer);
};
