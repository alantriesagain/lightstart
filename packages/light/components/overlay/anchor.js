/**
 * @bootstrapp/light/components/overlay/anchor
 *
 * Where a floating box goes when it is anchored to something else. Rects in,
 * a top and a left out, already clamped into the viewport, so the two things
 * that anchor in this package (a popover and a tooltip) agree on the answer
 * and `node --test` can ask for it directly. Nothing here touches the DOM or
 * reads `$APP`: the caller measures and the caller writes.
 */

/** @import { AnchorAlign, AnchorSide, Box, Rect } from "../types.ts" */

export const ANCHOR_GUTTER_PX = 8;

const SIDES = ["top", "bottom", "left", "right"];

/**
 * Read a `position` attribute as a side plus a cross-axis alignment.
 * `bottom-left` and `top-right` name both; a bare side takes `defaultAlign`,
 * except `left` and `right`, whose cross axis is vertical and which centre
 * unless a modifier says otherwise.
 *
 * @param {string} position
 * @param {AnchorAlign} [defaultAlign]
 * @returns {{ side: AnchorSide, align: AnchorAlign }}
 */
export const parseAnchor = (position, defaultAlign = "center") => {
  const [rawSide, modifier] = String(position ?? "").split("-");
  const side = /** @type {AnchorSide} */ (SIDES.includes(rawSide) ? rawSide : "bottom");
  const align = modifier === "left" || modifier === "top" || modifier === "start"
    ? "start"
    : modifier === "right" || modifier === "bottom" || modifier === "end"
      ? "end"
      : side === "left" || side === "right"
        ? "center"
        : defaultAlign;
  return { side, align };
};

/**
 * @param {number} value
 * @param {number} size
 * @param {number} limit
 * @param {number} gutter
 */
const clamp = (value, size, limit, gutter) => {
  const far = value + size > limit ? limit - size - gutter : value;
  return far < gutter ? gutter : far;
};

/**
 * The top-left corner a floating box takes against a trigger.
 *
 * @param {{ trigger: Rect, floating: Box, side: AnchorSide, align: AnchorAlign, offset?: number, viewport: Box, gutter?: number }} arg
 * @returns {{ top: number, left: number }}
 */
export const anchorPosition = ({ trigger, floating, side, align, offset = 0, viewport, gutter = ANCHOR_GUTTER_PX }) => {
  /**
   * @param {number} start
   * @param {number} extent
   * @param {number} size
   */
  const cross = (start, extent, size) =>
    align === "center" ? start + extent / 2 - size / 2 : align === "end" ? start + extent - size : start;

  let top = 0;
  let left = 0;
  if (side === "top" || side === "bottom") {
    top = side === "bottom" ? trigger.bottom + offset : trigger.top - floating.height - offset;
    left = cross(trigger.left, trigger.width, floating.width);
  } else {
    left = side === "right" ? trigger.right + offset : trigger.left - floating.width - offset;
    top = cross(trigger.top, trigger.height, floating.height);
  }

  return {
    left: clamp(left, floating.width, viewport.width, gutter),
    top: clamp(top, floating.height, viewport.height, gutter),
  };
};
