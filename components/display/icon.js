import T from "@bootstrapp/light/types";
import View, { defineComponent, trackWork } from "@bootstrapp/light";
import { icons } from "@bootstrapp/light/theme/icons.js";
import { ICON_NAME, maskRule } from "./icon-mask.js";
/** @import { IconEntry } from "@bootstrapp/light/theme" */
/** @import { IconVariant } from "../types.ts" */

/** @param {unknown} name */
const isIconName = (name) => typeof name === "string" && ICON_NAME.test(name);

/** @type {Map<string, Promise<IconEntry | null>>} */
const entries = new Map();
const drawn = new Set();
const devSheet = () => {
  const doc = globalThis.document;
  let tag = doc?.getElementById("lc-icon-rules");
  if (!tag && doc) {
    tag = doc.createElement("style");
    tag.id = "lc-icon-rules";
    doc.head.appendChild(tag);
  }
  return tag;
};

/** @param {string} name */
const entryFor = (name) => {
  let entry = entries.get(name);
  if (!entry) entries.set(name, (entry = icons.load ? icons.load(name) : Promise.resolve(null)));
  return entry;
};

/** @type {(name: string, variant: IconVariant) => string} */
const ruleKey = (name, variant) => (variant ? `${name}[${variant}]` : name);

/** @type {(solid: boolean, bold: boolean) => IconVariant[]} */
const variantsOf = (solid, bold) => ["", ...(solid ? /** @type {IconVariant[]} */ (["solid"]) : []), ...(bold ? /** @type {IconVariant[]} */ (["bold"]) : [])];

/** @type {(name: string, solid: boolean, bold: boolean) => Promise<void>} */
const drawIcon = async (name, solid, bold) => {
  const entry = await entryFor(name);
  const tag = devSheet();
  if (!entry || !tag) return;
  let added = "";
  for (const variant of variantsOf(solid, bold)) {
    const key = ruleKey(name, variant);
    if (drawn.has(key)) continue;
    drawn.add(key);
    const rule = maskRule(name, entry, { solid: variant === "solid", bold: variant === "bold" });
    if (rule) added += `${rule}\n`;
  }
  if (!added) return;
  tag.textContent += added;
};

export default defineComponent({
  tag: "lc-icon",
  style: true,
  props: {
    name: T.string(),
    solid: T.boolean(),
    bold: T.boolean(),
    size: T.string(),
    color: T.string({
      enum: [
        "primary",
        "secondary",
        "success",
        "danger",
        "warning",
        "info",
        "inverse",
      ],
    }),
  },
  /**
   * A page whose stylesheet has every rule (a build) leaves `icons.load` null,
   * so there is nothing to fetch. Otherwise each name is loaded once, and the
   * solid and the bold rule are drawn only once an element wants them.
   * @param {string} name
   * @param {boolean} [solid]
   * @param {boolean} [bold]
   */
  getIcon(name, solid = false, bold = false) {
    if (!isIconName(name) || !icons.load || variantsOf(solid, bold).every((variant) => drawn.has(ruleKey(name, variant)))) return;
    return trackWork(drawIcon(name, solid, bold), "icon").then(
      () => this.$requestUpdate(),
      (/** @type {unknown} */ error) => console.error(`Error drawing icon: ${name}`, error),
    );
  },
  /** @param {{ changedProps: Map<string, unknown> }} arg */
  willUpdate({ changedProps }) {
    this.applyNumericSize();
    if (changedProps.has("name") || changedProps.has("solid") || changedProps.has("bold")) return this.getIcon(this.name, this.solid, this.bold);
  },
  connected() {
    this.applyNumericSize();
    return this.getIcon(this.name, this.solid, this.bold);
  },
  applyNumericSize() {
    if (this.size && /^\d+$/.test(this.size))
      this.style.setProperty("--lc-icon-size", `${this.size}px`);
     else
      this.style.removeProperty("--lc-icon-size");

  },
  render() {
    if (this.name && !isIconName(this.name)) return this.name;
    return null;
  },
});

/**
 * Copyright (c) Alan Carlos Meira Leal
 *
 * Icon Component
 *
 * @component
 * @category media
 * @tag lc-icon
 *
 * Displays an SVG icon fetched dynamically from the configured icon font family.
 * Supports various sizes, semantic colors, and solid/outline styles.
 *
 * @property {string} name - The name of the icon to display (e.g., "home", "user", "settings")
 * @property {string} size - The size of the icon (xs, sm, md, lg, xl, 2xl, 3xl)
 * @property {string} color - Semantic color (primary, secondary, success, danger, warning, info, inverse)
 * @property {boolean} bold - Draws the strokes heavier. A build ships the bold shape for the names it finds drawn with `bold` (and `bundle.boldIcons`); any other name draws at its usual weight
 * @property {boolean} solid - Whether to use the solid/filled version of the icon style. A build ships the solid shape for the names it finds drawn with `solid` (and `bundle.solidIcons`); any other name draws its outline
 *
 * @example Basic Usage
 * ```html
 * <lc-icon name="house"></lc-icon>
 * ```
 *
 * @example All Sizes
 * ```html
 * * <lc-icon name="star" size="xs"></lc-icon>
 *
 * * <lc-icon name="star" size="sm"></lc-icon>
 *
 * * <lc-icon name="star" size="md"></lc-icon>
 *
 * * <lc-icon name="star" size="lg"></lc-icon>
 *
 * * <lc-icon name="star" size="xl"></lc-icon>
 *
 * * <lc-icon name="star" size="2xl"></lc-icon>
 *
 * * <lc-icon name="star" size="3xl"></lc-icon>
 *
 * * <lc-icon name="star" size="4xl"></lc-icon>
 * ```
 *
 * @example With Semantic Colors
 * ```html
 * <lc-icon name="circle-check" color="success" size="lg"></lc-icon>
 * <lc-icon name="exclamation-circle" color="danger" size="lg"></lc-icon>
 * <lc-icon name="info-circle" color="info" size="lg"></lc-icon>
 * ```
 *
 * @example Solid Style
 * ```html
 * * <lc-icon name="heart" size="xl" color="danger"></lc-icon>
 *
 * * <lc-icon name="heart" size="xl" color="danger" solid></lc-icon>
 * ```
 */
