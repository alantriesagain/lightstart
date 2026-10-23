import { defineComponent } from "@bootstrapp/light";
import { withPopover } from "@bootstrapp/light/components/mixins/popover.js";

export default defineComponent({
  mixins: [withPopover],
  tag: "lc-popover",
  style: true,
  props: {
    arrow: true,
  },
});

/**
 * Copyright (c) Alan Carlos Meira Leal
 *
 * Popover Component
 * Shows popover content on click using custom popover system.
 * Similar to dropdown but can contain any content (not just menu items).
 * `withPopover()` gives it positioning and state management.
 *
 * @slot - Default slot for popover content
 *
 * @property {string} position - Positioning relative to trigger (from `withPopover()`)
 * @property {boolean} arrow - Show arrow pointing to trigger (default true)
 *
 * @example Basic Popover
 * ```html
 * <lc-button popovertarget="info-popover">Show Info</lc-button>
 * <lc-popover id="info-popover">
 *   <div>Popover content here...</div>
 * </lc-popover>
 * ```
 *
 * @example Different Positions
 * ```html
 * <lc-button popovertarget="top-popover">Top</lc-button>
 * <lc-popover id="top-popover" position="top">
 *   <div>Content above</div>
 * </lc-popover>
 *
 * <lc-button popovertarget="bottom-popover">Bottom</lc-button>
 * <lc-popover id="bottom-popover" position="bottom">
 *   <div>Content below</div>
 * </lc-popover>
 * ```
 *
 * @example Without Arrow
 * ```html
 * <lc-button popovertarget="no-arrow">No Arrow</lc-button>
 * <lc-popover id="no-arrow" arrow="false">
 *   <div>Content without arrow</div>
 * </lc-popover>
 * ```
 */
