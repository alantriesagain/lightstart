/**
 * Showcase CSS variable editor
 * Extracts and displays editable CSS custom properties for a component
 */
import { html, nothing } from "@lightstart/light/html";

import { STARTER_THEME } from "../lib/starter-theme.ts";
import { stylePath } from "../lib/load.ts";
import { trackWork } from "@lightstart/light";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";

/**
 * @template V
 * @typedef {import("@lightstart/light/types").TypeDefinition<V>} Prop
 */
/** @typedef {Record<string, Record<string, Record<string, string>>>} ThemeOverrideMap */
/** @typedef {{ fallback: string, varName: string }} CssVarEntry */
/** @typedef {Map<string, CssVarEntry>} CssVarMap */

/**
 * Parse CSS text to extract component-scoped custom properties
 * @param {string} cssText - Raw CSS content
 * @param {string} componentName - Component prefix (e.g., "button", "card")
 * @returns {Map<string, {fallback: string, varName: string}>}
 */
function extractCSSVariables(cssText, componentName) {
  const vars = new Map();
  const prefix = `--${componentName}-`;
  let match;

  const escapedPrefix = prefix.replace(/[-]/g, "\\-");
  const declRegex = new RegExp(`(${escapedPrefix}[\\w-]+)\\s*:\\s*([^;]+)`, "g");
  while ((match = declRegex.exec(cssText)) !== null) {
    const varName = match[1];
    const value = match[2].trim();
    const property = varName.slice(prefix.length);
    vars.set(property, { fallback: value, varName });
  }

  const varRegex = /var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g;
  while ((match = varRegex.exec(cssText)) !== null) {
    const varName = match[1];
    const fallback = match[2]?.trim();
    if (varName.startsWith(prefix)) {
      const property = varName.slice(prefix.length);
      if (!vars.has(property))
        vars.set(property, { fallback: fallback || "", varName });
    }
  }

  return vars;
}

/** @param {unknown} value */
function isColorValue(value) {
  if (!value || typeof value !== "string") return false;
  const v = value.trim();
  return (
    /^#[0-9a-fA-F]{3,8}$/.test(v) ||
    v.startsWith("rgb") ||
    v.startsWith("hsl") ||
    v === "transparent"
  );
}

/** @param {string} value */
function toHex(value) {
  if (!value) return null;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v))
    return "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];

  return null;
}

export default defineComponent({
  tag: "showcase-css-editor",
  props: {
    componentTag: T.string(),
    themeOverrides: /** @type {Prop<ThemeOverrideMap>} */ (T.object({ defaultValue: {} })),
    cssVariables: /** @type {Prop<CssVarMap | null>} */ (T.object({ attribute: false })),
  },

  async connected() {
    await this._loadVariables();
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  async updated({ changedProps }) {
    if (changedProps.has("componentTag"))
      await this._loadVariables();
  },

  async _loadVariables() {
    if (!this.componentTag) return;
    const name = this.componentTag.replace(/^lc-/, "");
    const path = stylePath(name);
    if (!path) { this.cssVariables = null; return; }
    let cssText = null;
    try {
      const response = await trackWork(fetch(import.meta.resolve(path)), "showcase:css");
      if (response.ok) cssText = await response.text();
    } catch { }
    if (!cssText) { this.cssVariables = null; return; }
    this.cssVariables = extractCSSVariables(cssText, this.componentTag);
  },

  _getSection() {
    const tag = this.componentTag || "";
    const idx = tag.indexOf("-");
    if (idx < 0) return { group: tag, component: "" };
    return { group: tag.slice(0, idx), component: tag.slice(idx + 1) };
  },

  /** @param {string} property */
  _getCurrentValue(property) {
    const { group, component } = this._getSection();
    const override = this.themeOverrides[group]?.[component]?.[property];
    if (override !== undefined) return override;
    const varData = this.cssVariables?.get(property);
    return varData?.fallback || "";
  },

  /**
   * @param {string} property
   * @param {string} value
   */
  _handleChange(property, value) {
    const { group, component } = this._getSection();
    this.$emit("css-change", { group, component, property, value });
  },

  /**
   * @param {string} property
   * @param {CssVarEntry} varData
   */
  renderVariable(property, varData) {
    const currentValue = this._getCurrentValue(property);
    const isColor = isColorValue(currentValue) || property.includes("color") || property.includes("background");
    const hex = isColor ? toHex(currentValue) : null;

    return html`
      <div class="flex items-center gap-2 px-3 py-1.5 border-b border-surface-dark">
        ${isColor
          ? html`
            <input
              type="color"
              .value=${hex || STARTER_THEME.color.inverse}
              @input=${(/** @type {Event} */ e) => this._handleChange(property, /** @type {HTMLInputElement} */ (e.target).value)}
              class="w-5 h-5 rounded cursor-pointer flex-shrink-0"
            />
          `
          : nothing
        }
        <span class="text-xs font-medium min-w-[120px] truncate" title=${varData.varName}>${property}</span>
        <lc-input
          type="text"
          .value=${currentValue}
          @input=${(/** @type {CustomEvent<{ value: string }>} */ e) => this._handleChange(property, e.detail.value)}
          size="xs"
          mono
          class="flex-1"
        ></lc-input>
      </div>
    `;
  },

  _hasOverrides() {
    const { group, component } = this._getSection();
    const overrides = this.themeOverrides[group]?.[component];
    return overrides && Object.keys(overrides).length > 0;
  },

  _handleResetComponent() {
    const { group, component } = this._getSection();
    this.$emit("css-reset-component", { group, component });
  },

  _handleResetAll() {
    this.$emit("css-reset-all");
  },

  render() {
    if (!this.cssVariables)
      return html`
        <div class="text-center py-4">
          <lc-text size="xs" muted>No CSS variables found</lc-text>
        </div>
      `;

    if (this.cssVariables.size === 0)
      return html`
        <div class="text-center py-4">
          <lc-text size="xs" muted>No themeable CSS variables</lc-text>
        </div>
      `;

    const hasAnyOverrides = this.themeOverrides && Object.keys(this.themeOverrides).length > 0;

    return html`
      <div>
        <div class="flex items-center justify-between px-3 py-2 border-b border-surface-dark">
          <lc-text size="xs" muted>CSS Variables</lc-text>
          <div class="flex items-center gap-1">
            ${this._hasOverrides() ? html`
              <lc-link
                icon="rotate-ccw"
                size="sm"
                @click=${this._handleResetComponent}
                title="Reset component to defaults"
              ></lc-link>
            ` : nothing}
            ${hasAnyOverrides ? html`
              <lc-link
                icon="trash-2"
                size="sm"
                @click=${this._handleResetAll}
                title="Reset all theme overrides"
              ></lc-link>
            ` : nothing}
          </div>
        </div>
        ${[...this.cssVariables.entries()].map(([property, varData]) =>
          this.renderVariable(property, varData),
        )}
      </div>
    `;
  },
});
