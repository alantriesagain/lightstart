import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import { translation } from "@lightstart/light/i18n";

/** @import { Prop } from "../types.ts" */

/** @param {string} tag */
const displayName = (tag) => {
  if (typeof Intl.DisplayNames !== "function") return tag;
  try {
    return new Intl.DisplayNames([tag], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
};

export default defineComponent({
  tag: "lc-language-switcher",
  style: true,
  props: {
    label: "Language",
    labels: /** @type {Prop<Record<string, string>>} */ (
      T.object({ attribute: false, defaultValue: {} })
    ),
  },

  /** @param {string} tag */
  labelFor(tag) {
    return this.labels[tag] ?? displayName(tag);
  },

  /** @param {Event} e */
  change(e) {
    const select = /** @type {HTMLSelectElement} */ (e.target);
    translation.setLanguage(select.value);
  },

  render() {
    const languages = translation.languages();
    const current = translation.language();

    return html`
      <label part="lc-language-switcher-label">
        <span class="lc-language-switcher-caption">${this.label}</span>
        <select
          part="lc-language-switcher-select"
          aria-label=${this.label}
          @change=${this.change.bind(this)}
        >
          ${languages.map(
            (tag) => html`<option value=${tag} ?selected=${tag === current}>${this.labelFor(tag)}</option>`,
          )}
        </select>
      </label>
    `;
  },
});

/**
 * Language Switcher Component
 *
 * @component
 * @category navigation
 * @tag lc-language-switcher
 *
 * The languages a translation offers, with the current one selected. It reads
 * light's translation contract, so it works with any library plugged in with
 * `configureTranslation`.
 *
 * @example Basic Switcher
 * ```html
 * <lc-language-switcher></lc-language-switcher>
 * ```
 *
 * @example Custom Labels
 * `labels` maps a language tag to the word shown for it, over the name
 * `Intl.DisplayNames` gives the language in itself.
 * ```js
 * const labels = { en: "English", pt: "Português" };
 * html`<lc-language-switcher .labels=${labels}></lc-language-switcher>`
 * ```
 */
