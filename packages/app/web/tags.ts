/**
 * @file A tag table module's export, defined: a `View` subclass is registered
 * under its tag (a class view follows the signals it reads), and anything else
 * is a definition `View.define` takes. The generated `.light/components` calls
 * it for every tag it defines and every one it loads on demand.
 */

import View from "@lightstart/light";

type Definition = Parameters<typeof View.define>[0];

/** Whether `value` is a class extending `View`. */
const isViewClass = (value: unknown): value is typeof View => typeof value === "function" && value.prototype instanceof View;

/** Define `tag` from what its module default-exports. */
export const defineTag = (tag: string, value: unknown): void => {
  if (isViewClass(value)) {
    View.register(tag, value);
    return;
  }
  View.define(value as Definition);
};
