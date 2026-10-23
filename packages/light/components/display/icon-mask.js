/** An icon's body as a CSS mask rule, keyed by the `name` attribute. */

/** @import { IconEntry } from "@bootstrapp/light/theme" */

const ICON_NAME = /^[a-z][a-z0-9-]*$/;
const STROKE_WIDTH = /stroke-width="[\d.]+"/g;
const BOLD_STROKE = "2.5";

/**
 * @param {IconEntry} entry
 * @param {{ solid?: boolean, bold?: boolean }} [options] `bold` draws the strokes heavier
 * @returns {string}
 */
export const maskDataUri = ({ body, width, height }, { solid = false, bold = false } = {}) => {
  const painted = body.replaceAll("currentColor", "#000");
  const filled = solid ? painted.replaceAll('fill="none"', 'fill="#000"') : painted;
  const weighted = bold ? filled.replace(STROKE_WIDTH, `stroke-width="${BOLD_STROKE}"`) : filled;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${weighted}</svg>`;
  const encoded = svg
    .replace(/\s+/g, " ")
    .replaceAll('"', "'")
    .replaceAll("%", "%25")
    .replaceAll("#", "%23")
    .replaceAll("<", "%3C")
    .replaceAll(">", "%3E");
  return `data:image/svg+xml,${encoded}`;
};

/**
 * Whether filling the icon changes its shape; one that has no open paths looks
 * the same solid, and its outline rule already matches `[solid]`.
 * @param {IconEntry} entry
 * @returns {boolean}
 */
export const hasSolid = ({ body }) => body.includes('fill="none"');

/**
 * Whether the icon is drawn in strokes a heavier weight can thicken; one made
 * of fills looks the same bold, and its outline rule already matches `[bold]`.
 * @param {IconEntry} entry
 * @returns {boolean}
 */
export const hasBold = ({ body }) => /stroke-width="[\d.]+"/.test(body);

/**
 * @param {string} name
 * @param {IconEntry} entry
 * @param {{ solid?: boolean, bold?: boolean }} [options]
 * @returns {string}
 */
export const maskRule = (name, entry, { solid = false, bold = false } = {}) => {
  if (!ICON_NAME.test(name) || (solid && !hasSolid(entry)) || (bold && !hasBold(entry))) return "";
  const selector = `:where(.lc-icon,lc-icon)[name="${name}"]${solid ? "[solid]" : ""}${bold ? "[bold]" : ""}`;
  const uri = maskDataUri(entry, { solid, bold });
  return solid || bold
    ? `${selector}{--lc-icon-mask:url("${uri}")}`
    : `${selector}{--lc-icon-mask:url("${uri}");--lc-icon-paint:currentColor}`;
};

/**
 * The rules for `icons`, with a solid rule only for the names in `solid` and a
 * bold one only for the names in `bold`: an element whose rule is missing
 * still draws, as the outline.
 * @param {Array<{ name: string, entry: IconEntry }>} icons
 * @param {{ solid?: Set<string> | "all", bold?: Set<string> | "all" }} [options]
 * @returns {string}
 */
export const iconMaskCSS = (icons, { solid = new Set(), bold = new Set() } = {}) => {
  const rules = [];
  for (const { name, entry } of icons) {
    const outline = maskRule(name, entry);
    if (!outline) continue;
    rules.push(outline);
    if (solid === "all" || solid.has(name)) rules.push(maskRule(name, entry, { solid: true }));
    if (bold === "all" || bold.has(name)) rules.push(maskRule(name, entry, { bold: true }));
  }
  const css = rules.filter(Boolean).join("\n");
  return css ? `${css}\n` : "";
};

export { ICON_NAME };
