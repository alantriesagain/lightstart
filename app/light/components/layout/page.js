import { element, html } from "/app/__light-runtime__.js";
import { applyScopedTheme } from "/app/light/theme/index.js";
import DEFAULT_THEME from "../page/theme.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";
/** @import { Prop, PageSection } from "../types.js" */

/** @param {unknown} v */
const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} override
 */
const deepMerge = (base, override) => {
  if (!isPlainObject(override)) return override === undefined ? base : override;
  const out = { ...base };
  for (const [k, v] of Object.entries(override))
    out[k] = isPlainObject(v) && isPlainObject(base?.[k])
      ? deepMerge(/** @type {Record<string, unknown>} */ (base[k]), /** @type {Record<string, unknown>} */ (v))
      : v;

  return out;
};

/** @param {PageSection | null} section */
const renderSection = (section) => {
  if (!section || !section.type) return "";
  const { type, props = {} } = section;
  return element(type, Object.fromEntries(Object.entries(props).map(([k, v]) => [`.${k}`, v])));
};

export default defineComponent({
  tag: "lc-page",
  style: true,
  props: {
    theme: /** @type {Prop<Record<string, unknown> | null>} */ (
      T.object({ attribute: false, defaultValue: null })
    ),
    header: /** @type {Prop<PageSection | null>} */ (
      T.object({ attribute: false, defaultValue: null })
    ),
    sections: /** @type {Prop<PageSection[]>} */ (
      T.array({ attribute: false, defaultValue: [] })
    ),
    footer: /** @type {Prop<PageSection | null>} */ (
      T.object({ attribute: false, defaultValue: null })
    ),
  },
  connected() {
    this._applyTheme();
  },
  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("theme")) this._applyTheme();
  },
  _applyTheme() {
    const merged = deepMerge(DEFAULT_THEME, this.theme || {});
    applyScopedTheme("lc-page", merged, "lc-page-theme");
  },
  render() {
    return html`
      ${renderSection(this.header)}
      ${(this.sections || []).map((s) => renderSection(s))}
      ${renderSection(this.footer)}
    `;
  },
});
