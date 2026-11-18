import { html, nothing } from "@lightstart/light/html";
import { getComponentList } from "../lib/registry.ts";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import { STARTER_THEME } from "../lib/starter-theme.ts";
import { componentTags } from "../lib/load.ts";

/**
 * @template V
 * @typedef {import("@lightstart/light/types").TypeDefinition<V>} Prop
 */
/** @typedef {Record<string, Record<string, unknown>>} ThemeTokenMap */
/** @typedef {Record<string, string[]>} ThemeTokenKeys */
/** @typedef {Record<string, Record<string, string>>} ThemeValues */
/** @typedef {Record<string, Record<string, boolean>>} ThemeTouchedMap */
/** @typedef {Record<string, Record<string, Record<string, string>>>} ThemeOverrideMap */
/** @typedef {{ value: string, label: string }} LabeledOption */

const FONT_META_KEYS = new Set(["family", "heading"]);

const COLOR_PREFIX = /^(?:#|rgba?\(|hsla?\()/i;

/** @param {unknown} value */
const isColorLike = (value) => typeof value === "string" && COLOR_PREFIX.test(value.trim());

export default defineComponent({
  tag: "showcase-theme-editor",
  style: true,
  props: {
    theme: /** @type {Prop<ThemeTokenMap | null>} */ (
      T.object({ attribute: false, defaultValue: null })
    ),
    baseTheme: /** @type {Prop<ThemeTokenMap | null>} */ (
      T.object({ attribute: false, defaultValue: null })
    ),
    themeTokens: /** @type {Prop<ThemeTokenKeys | null>} */ (
      T.object({ attribute: false, defaultValue: null })
    ),
    showSections: /** @type {Prop<string[]>} */ (T.array({
      attribute: false,
      defaultValue: ["typography", "colors", "spacing", "edges"],
    })),
    values: /** @type {Prop<ThemeValues>} */ (T.object({ attribute: false, defaultValue: {} })),
    touched: /** @type {Prop<ThemeTouchedMap>} */ (
      T.object({ attribute: false, defaultValue: {} })
    ),
    componentList: /** @type {Prop<Record<string, string[]> | null>} */ (
      T.object({ attribute: false, defaultValue: null })
    ),
    selectedCSSComponent: T.string({ attribute: false, defaultValue: "" }),
    componentOverrides: /** @type {Prop<ThemeOverrideMap>} */ (
      T.object({ attribute: false, defaultValue: {} })
    ),
  },

  async connected() {
    this._initValues();
    if (this.showSections.includes("component-css"))
      this.componentList = getComponentList(componentTags());
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (
      changedProps.has("theme") ||
      changedProps.has("baseTheme") ||
      changedProps.has("themeTokens")
    )
      this._initValues();
  },

  _base() {
    return this.baseTheme || STARTER_THEME;
  },

  /** @param {string} category */
  _editableKeys(category) {
    const tokens = this.themeTokens;
    if (tokens && Array.isArray(tokens[category])) return tokens[category];
    if (tokens) return [];
    const base = this._base();
    return Object.keys(base[category] || {});
  },

  /** @param {string} category */
  _hasCategory(category) {
    return this._editableKeys(category).length > 0;
  },

  /**
   * @param {string} category
   * @param {string} key
   */
  _resolveValue(category, key) {
    const fromTheme = this.theme?.[category]?.[key];
    if (fromTheme != null && typeof fromTheme === "string") return fromTheme;
    const fromBase = this._base()?.[category]?.[key];
    if (fromBase != null && typeof fromBase === "string") return fromBase;
    const starter = STARTER_THEME[category]?.[key];
    return starter ?? "";
  },

  _initValues() {
    const categories = ["font", "text", "color", "spacing", "radius", "border", "shadow", "leading"];
    /** @type {ThemeValues} */
    const values = {};
    for (const cat of categories) {
      const keys = this._editableKeys(cat);
      if (keys.length === 0) continue;
      values[cat] = {};
      for (const k of keys) values[cat][k] = this._resolveValue(cat, k);
    }
    this.values = values;
    this.touched = {};
  },

  /**
   * @param {string} category
   * @param {string} key
   * @param {string} value
   */
  _updateValue(category, key, value) {
    this.values = {
      ...this.values,
      [category]: { ...(this.values[category] || {}), [key]: value },
    };
    this.touched = {
      ...this.touched,
      [category]: { ...(this.touched[category] || {}), [key]: true },
    };
    this._emit();
  },

  _emit() {
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { theme: this.generateThemeObject() },
        bubbles: true,
        composed: true,
      }),
    );
  },

  /** @param {{ detail: { group: string, component: string, property: string, value: string } }} arg */
  _handleComponentCSSChange({ detail }) {
    const { group, component, property, value } = detail;
    this.componentOverrides = {
      ...this.componentOverrides,
      [group]: {
        ...(this.componentOverrides[group] || {}),
        [component]: {
          ...(this.componentOverrides[group]?.[component] || {}),
          [property]: value,
        },
      },
    };
    this._emit();
  },

  /** @param {{ detail: { group: string, component: string } }} arg */
  _handleComponentCSSReset({ detail }) {
    const { group, component } = detail;
    const updated = { ...this.componentOverrides };
    if (updated[group]) {
      const { [component]: _, ...rest } = updated[group];
      if (Object.keys(rest).length === 0) delete updated[group];
      else updated[group] = rest;
    }
    this.componentOverrides = updated;
    this._emit();
  },

  generateThemeObject() {
    /** @type {ThemeTokenMap} */
    const theme = {};
    for (const [cat, keys] of Object.entries(this.touched)) {
      /** @type {Record<string, unknown>} */
      const out = {};
      let any = false;
      for (const k of Object.keys(keys)) {
        const v = this.values[cat]?.[k];
        if (v == null || v === "") continue;
        out[k] = v;
        any = true;
      }
      if (any) theme[cat] = out;
    }

    if (this.componentOverrides && Object.keys(this.componentOverrides).length > 0)
      for (const [group, components] of Object.entries(this.componentOverrides)) {
        if (!theme[group]) theme[group] = {};
        for (const [comp, props] of Object.entries(components)) {
          const previous = theme[group][comp];
          theme[group][comp] = {
            ...(typeof previous === "object" && previous !== null ? previous : {}),
            ...props,
          };
        }
      }

    return theme;
  },

  _getComponentOptions() {
    if (!this.componentList) return [];
    /** @type {LabeledOption[]} */
    const options = [];
    for (const [category, names] of Object.entries(this.componentList))
      for (const name of names) {
        const tag = `lc-${name}`;
        options.push({ value: tag, label: `${tag} (${category})` });
      }

    return options.sort((a, b) => a.value.localeCompare(b.value));
  },

  /**
   * @param {string} category
   * @param {string} key
   */
  _renderTextInput(category, key) {
    const value = this.values[category]?.[key] ?? "";
    return html`<div class="flex items-center gap-2">
      <span class="text-xs font-medium min-w-[60px]">${key}</span>
      <lc-input
        type="text"
        .value=${value}
        @input=${(/** @type {CustomEvent<{ value: string }>} */ e) =>
          this._updateValue(category, key, e.detail.value)}
        size="xs"
        mono
        class="flex-1"
      ></lc-input>
    </div>`;
  },

  /**
   * @param {string} category
   * @param {string} key
   */
  _renderColorInput(category, key) {
    const value = this.values[category]?.[key] ?? "";
    const swatch = isColorLike(value) && value.startsWith("#") ? value : STARTER_THEME.color.inverse;
    return html`<div class="flex items-center gap-2 px-2 py-1.5 border-b border-surface-dark">
      <input
        type="color"
        .value=${swatch}
        @input=${(/** @type {Event} */ e) => this._updateValue(category, key, /** @type {HTMLInputElement} */ (e.target).value)}
        class="w-6 h-6 rounded cursor-pointer flex-shrink-0"
      />
      <span class="text-xs font-medium min-w-[90px]">${key}</span>
      <lc-input
        type="text"
        .value=${value}
        @input=${(/** @type {CustomEvent<{ value: string }>} */ e) =>
          this._updateValue(category, key, e.detail.value)}
        size="xs"
        mono
        class="flex-1"
      ></lc-input>
    </div>`;
  },

  _renderColorsSection() {
    const keys = this._editableKeys("color");
    if (keys.length === 0) return nothing;
    return html`<div class="py-2">
      ${keys.map((k) => this._renderColorInput("color", k))}
    </div>`;
  },

  _renderSpacingSection() {
    const keys = this._editableKeys("spacing");
    if (keys.length === 0) return nothing;
    return html`<div class="grid grid-cols-2 gap-1.5 px-3 py-2">
      ${keys.map((k) => this._renderTextInput("spacing", k))}
    </div>`;
  },

  _renderEdgesSection() {
    const borderKeys = this._editableKeys("border");
    const radiusKeys = this._editableKeys("radius");
    const shadowKeys = this._editableKeys("shadow");
    if (borderKeys.length === 0 && radiusKeys.length === 0 && shadowKeys.length === 0)
      return nothing;

    return html`<div class="px-3 py-2">
      ${borderKeys.length > 0
        ? html`
            <span class="text-[10px] font-semibold uppercase text-muted mb-1 block">Border</span>
            <div class="grid grid-cols-2 gap-1.5 mb-3">
              ${borderKeys.map((k) => {
                const value = this.values.border?.[k] ?? "";
                if (k === "color") {
                  const swatch = isColorLike(value) && value.startsWith("#") ? value : STARTER_THEME.border.color;
                  return html`<div class="flex items-center gap-2">
                    <span class="text-xs font-medium min-w-[30px]">${k}</span>
                    <div class="flex items-center gap-1 flex-1">
                      <input
                        type="color"
                        .value=${swatch}
                        @input=${(/** @type {Event} */ e) => this._updateValue("border", k, /** @type {HTMLInputElement} */ (e.target).value)}
                        class="w-5 h-5 rounded cursor-pointer flex-shrink-0"
                      />
                      <lc-input
                        type="text"
                        .value=${value}
                        @input=${(/** @type {CustomEvent<{ value: string }>} */ e) =>
                          this._updateValue("border", k, e.detail.value)}
                        size="xs"
                        mono
                        class="flex-1"
                      ></lc-input>
                    </div>
                  </div>`;
                }
                return this._renderTextInput("border", k);
              })}
            </div>
          `
        : nothing}
      ${radiusKeys.length > 0
        ? html`
            <span class="text-[10px] font-semibold uppercase text-muted mb-1 block">Border Radius</span>
            <div class="grid grid-cols-2 gap-1.5 mb-3">
              ${radiusKeys.map((k) => this._renderTextInput("radius", k))}
            </div>
          `
        : nothing}
      ${shadowKeys.length > 0
        ? html`
            <span class="text-[10px] font-semibold uppercase text-muted mb-1 block">Shadows</span>
            <div class="flex flex-col gap-1.5">
              ${shadowKeys.map((k) => this._renderTextInput("shadow", k))}
            </div>
          `
        : nothing}
    </div>`;
  },

  _renderTypographySection() {
    const tokens = this.themeTokens;
    const fontKeys = this._editableKeys("font");
    const textKeys = this._editableKeys("text");
    const leadingKeys = this._editableKeys("leading");

    const showFamily = !tokens || fontKeys.includes("family") || fontKeys.includes("heading");
    const familyKeys = tokens
      ? fontKeys.filter((k) => FONT_META_KEYS.has(k))
      : ["family", "heading"];
    const weightKeys = fontKeys.filter((k) => !FONT_META_KEYS.has(k));

    const textSizeKeys = textKeys.filter((k) => k !== "color");
    const hasColorInText = textKeys.includes("color");

    if (
      fontKeys.length === 0 &&
      textKeys.length === 0 &&
      leadingKeys.length === 0
    )
      return nothing;

    return html`<div class="px-3 py-2">
      ${showFamily && familyKeys.length > 0
        ? html`
            <span class="text-[10px] font-semibold uppercase text-muted mb-1 block">Font Family</span>
            <div class="flex flex-col gap-1.5 mb-3">
              ${familyKeys.map((k) => {
                const value = this.values.font?.[k] ?? "";
                return html`<div class="flex items-center gap-2">
                  <span class="text-xs font-medium min-w-[60px] capitalize">
                    ${k === "family" ? "Body" : k}
                  </span>
                  <lc-input
                    type="text"
                    .value=${value}
                    @input=${(/** @type {CustomEvent<{ value: string }>} */ e) =>
                      this._updateValue("font", k, e.detail.value)}
                    placeholder=${k === "heading"
                      ? "Defaults to body font"
                      : "e.g. Inter, Manrope..."}
                    size="xs"
                    class="flex-1"
                  ></lc-input>
                </div>`;
              })}
            </div>
          `
        : nothing}
      ${hasColorInText
        ? html`
            <span class="text-[10px] font-semibold uppercase text-muted mb-1 block">Text Color</span>
            <div class="mb-3">${this._renderColorInput("text", "color")}</div>
          `
        : nothing}
      ${textSizeKeys.length > 0
        ? html`
            <span class="text-[10px] font-semibold uppercase text-muted mb-1 block">Font Sizes</span>
            <div class="grid grid-cols-2 gap-1.5 mb-3">
              ${textSizeKeys.map((k) => this._renderTextInput("text", k))}
            </div>
          `
        : nothing}
      ${weightKeys.length > 0 || leadingKeys.length > 0
        ? html`
            <details class="mt-2">
              <summary
                class="text-[10px] font-semibold uppercase text-muted cursor-pointer mb-1"
              >
                Advanced
              </summary>
              ${weightKeys.length > 0
                ? html`
                    <span class="text-[10px] font-semibold uppercase text-muted mb-1 mt-2 block">
                      Font Weights
                    </span>
                    <div class="grid grid-cols-2 gap-1.5 mb-3">
                      ${weightKeys.map((k) => this._renderTextInput("font", k))}
                    </div>
                  `
                : nothing}
              ${leadingKeys.length > 0
                ? html`
                    <span class="text-[10px] font-semibold uppercase text-muted mb-1 block">
                      Line Heights
                    </span>
                    <div class="grid grid-cols-2 gap-1.5">
                      ${leadingKeys.map((k) => this._renderTextInput("leading", k))}
                    </div>
                  `
                : nothing}
            </details>
          `
        : nothing}
    </div>`;
  },

  _renderComponentCSSSection() {
    const options = this._getComponentOptions();
    return html`<div class="p-2">
      <lc-select
        searchable
        size="xs"
        placeholder="Search component..."
        .options=${options}
        .value=${this.selectedCSSComponent || ""}
        @change=${(/** @type {CustomEvent<{ value: string }>} */ e) => {
          this.selectedCSSComponent = e.detail.value;
        }}
        class="w-full mb-2"
      ></lc-select>
      ${this.selectedCSSComponent
        ? html`
            <showcase-css-editor
              .componentTag=${this.selectedCSSComponent}
              .themeOverrides=${this.componentOverrides}
              @css-change=${this._handleComponentCSSChange}
              @css-reset-component=${this._handleComponentCSSReset}
            ></showcase-css-editor>
          `
        : html`<lc-text size="xs" muted class="text-center block py-3">
            Select a component to edit its CSS variables
          </lc-text>`}
    </div>`;
  },

  render() {
    const s = this.showSections || [];
    const sections = [];

    if (s.includes("typography")) {
      const content = this._renderTypographySection();
      if (content !== nothing)
        sections.push(html`
          <button open>
            <lc-icon name="type" size="14" class="mr-2"></lc-icon>Typography
          </button>
          <div>${content}</div>
        `);
    }

    if (s.includes("colors")) {
      const content = this._renderColorsSection();
      if (content !== nothing)
        sections.push(html`
          <button open>
            <lc-icon name="palette" size="14" class="mr-2"></lc-icon>Colors
          </button>
          <div>${content}</div>
        `);
    }

    if (s.includes("component-css"))
      sections.push(html`
        <button>
          <lc-icon name="paintbrush" size="14" class="mr-2"></lc-icon>Component CSS
        </button>
        <div>${this._renderComponentCSSSection()}</div>
      `);

    if (s.includes("spacing")) {
      const content = this._renderSpacingSection();
      if (content !== nothing)
        sections.push(html`
          <button>
            <lc-icon name="move" size="14" class="mr-2"></lc-icon>Spacing
          </button>
          <div>${content}</div>
        `);
    }

    if (s.includes("edges")) {
      const content = this._renderEdgesSection();
      if (content !== nothing)
        sections.push(html`
          <button>
            <lc-icon name="square" size="14" class="mr-2"></lc-icon>Edges
          </button>
          <div>${content}</div>
        `);
    }

    if (sections.length === 0)
      return html`<div class="p-4 text-xs text-muted text-center">
        No editable tokens for this configuration.
      </div>`;

    return html`<lc-accordion variant="flush">${sections}</lc-accordion>`;
  },
});
