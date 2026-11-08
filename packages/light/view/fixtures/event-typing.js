/**
 * What a listener reads from an event a definition declares, held by the type
 * checker: `npm run typecheck` fails when a line below stops meaning what it says.
 */

import { defineComponent } from "../index.js";
import T from "../../types/index.js";

/** @import { ComponentEvent } from "../types.ts" */

export const picker = defineComponent({
  tag: "fx-event-typing",
  events: {
    change: T.object({ value: T.string(), count: T.number() }),
    toggle: T.boolean(),
  },
});

/** @param {ComponentEvent<typeof picker, "change">} e */
export const onChange = (e) => {
  /** @type {string} */ const value = e.detail.value;
  /** @type {number} */ const count = e.detail.count;
  // @ts-expect-error a field of the detail keeps the type its descriptor declares
  /** @type {number} */ const wrong = e.detail.value;
  return [value, count, wrong];
};

/** @param {ComponentEvent<typeof picker, "toggle">} e */
export const onToggle = (e) => {
  /** @type {boolean} */ const open = e.detail;
  return open;
};

/** @param {ComponentEvent<typeof picker, "undeclared">} e */
export const onUndeclared = (e) => {
  /** @type {unknown} */ const detail = e.detail;
  // @ts-expect-error an event the definition does not declare has an unknown detail
  /** @type {string} */ const wrong = e.detail;
  return [detail, wrong];
};
