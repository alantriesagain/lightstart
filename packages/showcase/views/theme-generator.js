/**
 * The theme generator: the catalogue on the left, the token editor on the
 * right, and an export button under it.
 *
 * The gallery it used to carry was hand-written markup covering twenty
 * components, maintained by hand and already behind the library. It renders
 * the showcase instead, so the thing being restyled is the thing that ships.
 */
import { applyTheme, loadFont } from "@lightstart/light/theme";
import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import { STARTER_THEME } from "../lib/starter-theme.ts";

/**
 * @template V
 * @typedef {import("@lightstart/light/types").TypeDefinition<V>} Prop
 */
/** @typedef {Record<string, Record<string, unknown>>} ThemeTokenMap */
/** @typedef {import("@lightstart/light/theme").FontValue} FontValue */

export default defineComponent({
  tag: "showcase-theme-generator",
  props: {
    themeName: "custom-theme",
    latestTheme: /** @type {Prop<ThemeTokenMap | null>} */ (
      T.object({ attribute: false, defaultValue: null })
    ),
  },

  /** @param {CustomEvent<{ theme: ThemeTokenMap }>} e */
  _handleThemeChange(e) {
    const sparse = e.detail.theme;
    const base = this.latestTheme || STARTER_THEME;
    /** @type {ThemeTokenMap} */
    const merged = { ...base };
    for (const [cat, keys] of Object.entries(sparse))
      merged[cat] = { ...(base[cat] || {}), ...keys };

    this.latestTheme = merged;
    applyTheme(merged);
    const family = /** @type {FontValue | undefined} */ (merged.font?.family);
    const heading = /** @type {FontValue | undefined} */ (merged.font?.heading);
    if (family) loadFont(family, "font-family-base");
    if (heading) loadFont(heading, "font-heading");
  },

  exportTheme() {
    const theme = { name: this.themeName, ...(this.latestTheme || {}) };
    const themeCode = `/**
 * ${theme.name} Theme
 * Generated with the theme generator
 */

export default ${JSON.stringify(theme, null, 2)};
`;

    const blob = new Blob([themeCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.themeName}.js`;
    a.click();
    URL.revokeObjectURL(url);
  },

  renderControlsPanel() {
    return html`
      <div class="flex flex-col h-full overflow-x-hidden">
        <div class="flex-1 overflow-y-auto min-h-0">
          <showcase-theme-editor
            .theme=${this.latestTheme || STARTER_THEME}
            .baseTheme=${this.latestTheme || STARTER_THEME}
            .showSections=${["typography", "colors", "component-css", "spacing", "edges"]}
            @change=${(/** @type {CustomEvent<{ theme: ThemeTokenMap }>} */ e) => this._handleThemeChange(e)}
          ></showcase-theme-editor>
        </div>

        <div class="px-3 py-2 border-t border-surface-dark">
          <lc-input
            type="text"
            .value=${this.themeName}
            @input=${(/** @type {CustomEvent<{ value: string }>} */ e) => {
              this.themeName = e.detail.value;
            }}
            placeholder="Theme name..."
            size="xs"
            class="mb-2 w-full"
          ></lc-input>
          <lc-button variant="primary" w-full @click=${() => this.exportTheme()}>
            <lc-icon name="download"></lc-icon>
            Export Theme
          </lc-button>
        </div>
      </div>
    `;
  },

  render() {
    return html`
      <div class="flex h-full min-h-0">
        <div class="flex-1 min-w-0 overflow-hidden">
          <showcase-catalogue></showcase-catalogue>
        </div>
        <div class="w-[360px] flex-shrink-0 h-full min-h-0 border-l border-surface-dark">
          ${this.renderControlsPanel()}
        </div>
      </div>
    `;
  },
});
