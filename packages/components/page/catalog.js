/** @import { CatalogEntry } from "../types.ts" */

/** @type {CatalogEntry[]} */
export const SECTION_CATALOG = [
  { tag: "lc-hero-section", label: "Hero", icon: "layout-template" },
  { tag: "lc-about-section", label: "About", icon: "type" },
  { tag: "lc-showcase-section", label: "Showcase", icon: "image" },
  { tag: "lc-feature-grid", label: "Features", icon: "grid-3x3" },
  { tag: "lc-steps-section", label: "Steps", icon: "list-ordered" },
  {
    tag: "lc-testimonial-section",
    label: "Testimonials",
    icon: "message-square-quote",
  },
  { tag: "lc-faq-section", label: "FAQ", icon: "circle-help" },
  { tag: "lc-pricing-table", label: "Pricing", icon: "credit-card" },
  { tag: "lc-stats-section", label: "Stats", icon: "bar-chart-3" },
  { tag: "lc-cta-section", label: "Call to Action", icon: "megaphone" },
];

/** @type {CatalogEntry[]} */
export const HEADER_CATALOG = [
  { tag: "lc-site-header", label: "Site Header", icon: "panel-top" },
];

/** @type {CatalogEntry[]} */
export const FOOTER_CATALOG = [
  { tag: "lc-footer", label: "Site Footer", icon: "panel-bottom" },
];

export const CATALOG_BY_TAG = [
  ...SECTION_CATALOG,
  ...HEADER_CATALOG,
  ...FOOTER_CATALOG,
].reduce((/** @type {Record<string, CatalogEntry>} */ acc, entry) => {
  acc[entry.tag] = entry;
  return acc;
}, {});

export default SECTION_CATALOG;
