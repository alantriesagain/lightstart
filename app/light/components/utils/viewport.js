/**
 * The widths the showcase renders a component at. One table, read by the
 * showcase and by the standalone preview, so the two cannot offer different
 * sizes.
 *
 * Width `0` means the stage takes whatever room it has.
 */

export const VIEWPORT_PRESETS = [
  { label: "Mobile", width: 375, icon: "smartphone" },
  { label: "Tablet", width: 768, icon: "tablet" },
  { label: "Full width", width: 0, icon: "monitor" },
];

export const VIEWPORT_MAX = 1920;

/** @param {number} width */
export const viewportCss = (width) => (width === 0 ? "100%" : `${width}px`);

/** @param {number} width */
export const viewportLabel = (width) => (width === 0 ? "100%" : `${width}px`);

/** @param {number} value a slider reading, where the top of the range means full width */
export const viewportFromSlider = (value) => (value >= VIEWPORT_MAX ? 0 : value);

/** @param {number} width */
export const sliderFromViewport = (width) => (width === 0 ? VIEWPORT_MAX : width);
