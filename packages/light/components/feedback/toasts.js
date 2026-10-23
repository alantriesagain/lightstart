/**
 * The notification queue: what is showing, and the timer that takes each entry
 * off again. `<lc-toast>` renders it, so anything on the page can raise one
 * with `toasts.show(...)` without finding the element first.
 *
 * How long an entry stays is the queue's business, not each caller's: an error
 * holds longer than the rest unless the call says otherwise. An entry shown
 * with `onTap` is a button: a tap takes it off and runs it, which is how a
 * toast about something opens that thing.
 */

import { signal } from "@bootstrapp/light/signals";

/** @import { ToastItem, ToastQueue } from "../types.ts" */

const DEFAULT_DURATION = 3000;
const ERROR_DURATION = 5000;

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const timers = new Map();
let lastId = 0;

/** @type {ToastQueue} */
export const toasts = {
  items: signal(/** @type {ToastItem[]} */ ([])),

  show({ title = "", message = "", variant = "default", icon = "", duration, closable = true, onTap } = {}) {
    const id = `t${(lastId += 1)}`;
    const ms = duration ?? (variant === "error" ? ERROR_DURATION : DEFAULT_DURATION);
    toasts.items.value = [...toasts.items.value, { id, title, message, variant, icon, duration: ms, closable, ...(onTap ? { onTap } : {}) }];
    if (ms > 0) timers.set(id, setTimeout(() => toasts.hide(id), ms));
    return id;
  },

  success: (message, options) => toasts.show({ ...options, message, variant: "success" }),
  error: (message, options) => toasts.show({ ...options, message, variant: "error" }),
  warning: (message, options) => toasts.show({ ...options, message, variant: "warning" }),
  info: (message, options) => toasts.show({ ...options, message, variant: "info" }),

  /**
   * What a tap on an entry does: takes it off, then runs what it was shown with.
   * @param {string} id
   */
  tap(id) {
    const entry = toasts.items.value.find((item) => item.id === id);
    toasts.hide(id);
    entry?.onTap?.();
  },

  /** @param {string} id */
  hide(id) {
    clearTimeout(timers.get(id));
    timers.delete(id);
    toasts.items.value = toasts.items.value.filter((item) => item.id !== id);
  },

  hideAll() {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    toasts.items.value = [];
  },
};
