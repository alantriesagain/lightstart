import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { anchorPosition, parseAnchor } from "./anchor.js";
import { env } from "@bootstrapp/light/env";

/** @import { Prop } from "../types.ts" */

const TOOLTIP_OFFSET_PX = 6;

export default defineComponent({
  tag: "lc-tooltip",
  style: true,

  props: {
    _parent: /** @type {Prop<HTMLElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _showTimer: /** @type {Prop<ReturnType<typeof setTimeout> | null>} */ (T.object({ reactive: false, defaultValue: null })),
    position: T.string({
      defaultValue: "top",
      enum: ["top", "bottom", "left", "right"],
    }),
    variant: T.string({
      defaultValue: "default",
      enum: [
        "default",
        "primary",
        "secondary",
        "success",
        "warning",
        "danger",
        "info",
      ],
    }),
    size: T.string({
      defaultValue: "md",
      enum: ["sm", "md", "lg"],
    }),
    delay: 100,
  },

  /** @param {DOMRect} rect */
  positionAt(rect) {
    const { side, align } = parseAnchor(this.position);
    const { top, left } = anchorPosition({
      trigger: rect,
      floating: this.getBoundingClientRect(),
      side,
      align,
      offset: TOOLTIP_OFFSET_PX,
      viewport: { width: env.width, height: env.height },
    });
    this.style.top = `${top}px`;
    this.style.left = `${left}px`;
  },

  show() {
    if (this._showTimer) clearTimeout(this._showTimer);
    this._showTimer = setTimeout(() => {
      if (!this._parent) return;
      try {
        this.showPopover();
      } catch {}
      this.positionAt(this._parent.getBoundingClientRect());
    }, this.delay);
  },

  hide() {
    if (this._showTimer) clearTimeout(this._showTimer);
    this._showTimer = null;
    try {
      this.hidePopover();
    } catch {}
  },

  connected() {
    this.setAttribute("popover", "manual");
    const parent = this.parentElement;
    if (!parent) return;
    this._parent = parent;

    const onEnter = () => this.show();
    const onLeave = () => this.hide();
    for (const name of ["mouseenter", "focusin"]) parent.addEventListener(name, onEnter);
    for (const name of ["mouseleave", "focusout"]) parent.addEventListener(name, onLeave);
    this.$own(() => {
      if (this._showTimer) clearTimeout(this._showTimer);
      this._showTimer = null;
      for (const name of ["mouseenter", "focusin"]) parent.removeEventListener(name, onEnter);
      for (const name of ["mouseleave", "focusout"]) parent.removeEventListener(name, onLeave);
      this._parent = null;
    });
  },
});

/**
 * Copyright (c) Alan Carlos Meira Leal
 *
 * Tooltip Component - CSS-First
 *
 * @component
 * @category overlay
 * @tag lc-tooltip
 *
 * Shows contextual information on hover. Uses CSS-based positioning.
 * Parent element automatically becomes the positioning anchor.
 *
 * @slot - Tooltip content text
 *
 * @property {string} position - Positioning: top, bottom, left, right (default: top)
 * @property {number} delay - Delay in milliseconds before showing (default: 200)
 *
 * @example Basic Tooltip
 * ```html
 * <lc-button>
 *   Hover me
 *   <lc-tooltip>Helpful information here</lc-tooltip>
 * </lc-button>
 * ```
 *
 * @example Different Positions
 * ```html
 * <lc-button>
 *   Right
 *   <lc-tooltip position="right">Right tooltip</lc-tooltip>
 * </lc-button>
 * ```
 *
 * @example Custom delay
 * ```html
 * <lc-button>
 *   Instant
 *   <lc-tooltip delay="0">Shows immediately</lc-tooltip>
 * </lc-button>
 * ```
 */
