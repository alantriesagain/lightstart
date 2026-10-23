/**
 * The overlay stack: which layer is on top, whose Escape it is, whose opener
 * takes focus back, and whether the body scrolls.
 *
 * Escape belongs to one layer, the topmost that will take it. A document
 * listener per overlay gives every mounted one the same keystroke, so opening a
 * search inside a drawer closes both.
 *
 * The scroll lock is recomputed from the stack rather than toggled, so closing
 * one of two locking layers leaves the body locked for the one still open.
 *
 * A native `<dialog>` owns its own Escape and focus restore through the top
 * layer, so it registers with neither: it joins for the accounting and the
 * lock, and nothing here answers for it.
 */

import { signal } from "@bootstrapp/light/signals";

/** @import { OverlayEntry, OverlayOptions } from "../types.ts" */

let lastId = 0;
let listening = false;

/** @param {Event} event */
const onKeydown = (event) => {
  if (/** @type {KeyboardEvent} */ (event).key !== "Escape") return;
  const top = overlays.stack.value.at(-1);
  if (!top?.dismissible) return;
  event.preventDefault();
  event.stopPropagation();
  top.dismiss?.();
};

const syncScrollLock = () => {
  document.body.style.overflow = overlays.stack.value.some((layer) => layer.lockScroll) ? "hidden" : "";
};

export const overlays = {
  stack: signal(/** @type {OverlayEntry[]} */ ([])),

  /**
   * @param {Element} host
   * @param {OverlayOptions} [options]
   * @returns {string} the id this layer closes with
   */
  open(host, { dismiss, dismissible = true, lockScroll = false, restoreFocus = true } = {}) {
    if (!listening) {
      document.addEventListener("keydown", onKeydown, true);
      listening = true;
    }
    const active = document.activeElement;
    const opener = restoreFocus && active instanceof HTMLElement ? active : null;
    const id = `ov${(lastId += 1)}`;
    overlays.stack.value = [...overlays.stack.value, { id, host, dismiss, dismissible, lockScroll, opener }];
    syncScrollLock();
    return id;
  },

  /** @param {string | null} id */
  close(id) {
    const entry = overlays.stack.value.find((layer) => layer.id === id);
    if (!entry) return;
    overlays.stack.value = overlays.stack.value.filter((layer) => layer.id !== id);
    syncScrollLock();
    if (entry.opener?.isConnected) entry.opener.focus();
  },

  /** @param {string | null} id @returns {boolean} whether this layer is the one Escape would reach */
  isTop(id) {
    return Boolean(id) && overlays.stack.value.at(-1)?.id === id;
  },

  closeTop() {
    overlays.close(overlays.stack.value.at(-1)?.id ?? null);
  },
};
