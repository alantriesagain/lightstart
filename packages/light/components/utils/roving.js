/**
 * @bootstrapp/light/components/utils/roving
 *
 * Which item an arrow key moves to. Five components in this package answer
 * that question and answered it five ways: a tablist wrapping with Home and
 * End, a menu wrapping from nothing to whichever end the key points at, a
 * select and a search box clamping at both ends with the same three lines, a
 * story viewer refusing to move past either end. One function covers all of
 * them, and a null says the key moved nothing, so a caller emits only when
 * something changed.
 */

/** @import { RovingOptions } from "../types.ts" */

/**
 * The index `key` moves to from `current`, or null if it moves nowhere.
 *
 * `current` below zero means nothing is selected yet: a forward key takes the
 * first item, and a backward key takes the last one when the list wraps and
 * the first when it does not, which is the difference between arriving at a
 * menu from the end and stopping at the top of a filtered list.
 *
 * @param {string} key
 * @param {number} current
 * @param {number} length
 * @param {RovingOptions} [options]
 * @returns {number | null}
 */
export const nextIndex = (key, current, length, { wrap = false, orientation = "vertical", homeEnd = false } = {}) => {
  if (length <= 0) return null;

  if (homeEnd && key === "Home") return current === 0 ? null : 0;
  if (homeEnd && key === "End") return current === length - 1 ? null : length - 1;

  const vertical = orientation !== "horizontal";
  const horizontal = orientation !== "vertical";
  const forward = (vertical && key === "ArrowDown") || (horizontal && key === "ArrowRight");
  const backward = (vertical && key === "ArrowUp") || (horizontal && key === "ArrowLeft");
  if (!forward && !backward) return null;

  if (current < 0) return forward ? 0 : wrap ? length - 1 : 0;

  const delta = forward ? 1 : -1;
  const next = wrap
    ? (current + delta + length) % length
    : Math.min(length - 1, Math.max(0, current + delta));
  return next === current ? null : next;
};
