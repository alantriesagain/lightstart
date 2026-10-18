/**
 * What the command palette searches: every component, the site's pages and
 * every skin, as the documents `<lc-search>` ranks.
 */
import { componentPath } from "./paths.js";
import { NATIVE_PAGES } from "./native/pages.js";

/** @import { SearchDoc } from "@bootstrapp/light/components/types.ts" */
/** @import { ShowcaseCategoryListing } from "@bootstrapp/showcase/types.ts" */
/** @import { ThemePreset } from "@bootstrapp/light/theme" */

export const GROUPS = ["Components", "Pages", "Skins"];

/** @type {{ title: string, href: string, hint: string }[]} */
export const PAGES = [
  { title: "Components", href: "/components", hint: "Every component, by category" },
  { title: "Theming", href: "/theming", hint: "Edit the tokens and export a theme" },
  { title: "Skins", href: "/skins", hint: "Each preset on the same controls" },
  ...NATIVE_PAGES.map((page) => ({ title: page.topic ? `Native: ${page.label}` : "Native", href: page.href, hint: page.hint })),
];

/** @param {string} name */
const humanize = (name) =>
  name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * @param {ShowcaseCategoryListing[]} listings
 * @param {ThemePreset[]} presets
 * @returns {SearchDoc[]}
 */
export const searchIndex = (listings, presets) => [
  ...listings.flatMap((category) =>
    category.components.map((name) => ({
      id: `component:${category.id}/${name}`,
      group: GROUPS[0],
      title: humanize(name),
      hint: `lc-${name} · ${category.label}`,
      href: componentPath(category.id, name),
      kind: "component",
    })),
  ),
  ...PAGES.map((page) => ({ id: `page:${page.href}`, group: GROUPS[1], title: page.title, hint: page.hint, href: page.href, kind: "page" })),
  ...presets.map((preset) => ({
    id: `skin:${preset.name}`,
    group: GROUPS[2],
    title: preset.label,
    hint: preset.description,
    kind: "skin",
    skin: preset.name,
  })),
];
