import { html } from "@bootstrapp/light/html";
import { lcText } from "../utils/text.js";

/**
 * Render a resource with the stale-while-revalidate precedence encoded
 * once instead of hand-rolled per view: a present value renders even
 * while a refresh is in flight (old data beats a spinner), an error
 * shows only when there is nothing to render over it, the spinner only
 * when there is genuinely nothing yet, and a resolved-but-empty array
 * gets the empty state. Returns a thunk: embed as
 * `${loaded(res, (rows) => ...)}`: so the view re-renders nothing when
 * only the resource changes. Calls `res.ensure()` lazily (rejections
 * land in `res.error` and render); pass `ensure: false` to opt out.
 *
 * @template T
 * @param {{ value: { value: T | null | undefined }, error: { value: unknown }, pending: { value: boolean }, ensure(): unknown }} res a resource: `bootstrapp/controller`'s, or anything of that shape
 * @param {(value: T) => unknown} render
 * @param {{ loading?: () => unknown, empty?: () => unknown, error?: (err: unknown) => unknown, ensure?: boolean }} [opts]
 * @returns {() => unknown}
 */
export const loaded = (res, render, { loading, empty, error, ensure = true } = {}) => () => {
  if (ensure) Promise.resolve(res.ensure()).catch(() => {});
  const value = res.value.value;
  if (value !== undefined && value !== null) {
    if (empty && Array.isArray(value) && value.length === 0) return empty();
    return render(value);
  }
  const err = res.error.value;
  if (err) return error ? error(err) : html`<lc-flex justify="center" class="py-16"><lc-text size="sm" class="text-muted">${lcText("lc-async", "failed")}</lc-text></lc-flex>`;
  res.pending.value;
  return loading ? loading() : html`<lc-flex justify="center" class="py-16"><lc-spinner></lc-spinner></lc-flex>`;
};
