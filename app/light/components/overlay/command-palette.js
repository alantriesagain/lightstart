import { html, nothing } from "/app/light/html/index.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";
import { matchesShortcut, parseShortcut, shortcutKeys } from "../utils/shortcut.js";
import { lcText } from "../utils/text.js";
import { env } from "/app/light/env/index.js";
/** @import { Prop, SearchDoc, SearchElement } from "../types.js" */

const TAG = "lc-command-palette";

/** @param {EventTarget | null} target */
const isEditable = (target) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Command Palette Component
 *
 * @component
 * @category overlay
 * @tag lc-command-palette
 *
 * A search over the app's places, opened from anywhere by a shortcut or from
 * its own trigger, shown in a dialog with the keys that drive it. `compact`
 * shrinks the trigger to its icon for a narrow header.
 *
 * @example
 * ```html
 * <lc-command-palette shortcut="mod+k" .docs=${docs} .groups=${["Components", "Pages"]}></lc-command-palette>
 * ```
 */
export default defineComponent({
  tag: "lc-command-palette",
  icons: ["search"],
  style: true,
  props: {
    docs: /** @type {Prop<SearchDoc[]>} */ (T.array({ attribute: false, defaultValue: [] })),
    suggestions: /** @type {Prop<SearchDoc[]>} */ (T.array({ attribute: false, defaultValue: [] })),
    groups: /** @type {Prop<string[]>} */ (T.array({ defaultValue: [] })),
    placeholder: "",
    shortcut: "mod+k",
    open: T.boolean(),
    hideTrigger: T.boolean(),
    compact: T.boolean(),
    limit: 8,
    renderResult: T.function(),
  },
  events: {
    "command-select": T.object(),
  },
  _keys() {
    return shortcutKeys(parseShortcut(this.shortcut), env.os);
  },
  connected() {
    const onKey = /** @type {EventListener} */ ((event) => {
      const e = /** @type {KeyboardEvent} */ (event);
      const parsed = parseShortcut(this.shortcut);
      const bare = !parsed.mod && !parsed.ctrl && !parsed.meta && !parsed.alt;
      if (bare && isEditable(e.target)) return;
      if (!matchesShortcut(e, parsed)) return;
      e.preventDefault();
      this.open = !this.open;
    });
    document.addEventListener("keydown", onKey);
    this.$own(() => document.removeEventListener("keydown", onKey));
  },
  _focusSearch() {
    customElements.whenDefined("lc-search").then(() => /** @type {SearchElement | null} */ (this.querySelector("lc-search"))?.focusInput());
  },
  /** @param {Event} e */
  _closed(e) {
    const modal = /** @type {{ dialog?: HTMLDialogElement | null }} */ (/** @type {unknown} */ (e.currentTarget));
    if (modal.dialog?.open) return;
    this.open = false;
  },
  /** @param {CustomEvent<SearchDoc>} e */
  _select(e) {
    this.open = false;
    this.$emit("command-select", e.detail);
  },
  render() {
    const placeholder = this.placeholder || lcText(TAG, "placeholder");
    return html`
      ${this.hideTrigger
        ? nothing
        : html`
            <button type="button" class="command-palette-trigger" data-compact=${this.compact ? "" : nothing} aria-haspopup="dialog" aria-expanded=${String(this.open)} @click=${() => { this.open = true; }}>
              <lc-icon name="search" size=${this.compact ? "18" : "15"}></lc-icon>
              <span class="command-palette-placeholder">${placeholder}</span>
              <span class="command-palette-keys">${this._keys().map((key) => html`<lc-kbd>${key}</lc-kbd>`)}</span>
            </button>
          `}
      <lc-modal class="command-palette-modal" size="sm" ?open=${this.open} @modal-open=${this._focusSearch} @modal-close=${this._closed}>
        <lc-search
          inline
          autofocus
          .docs=${this.docs}
          .suggestions=${this.suggestions}
          .groups=${this.groups}
          .renderResult=${this.renderResult}
          placeholder=${placeholder}
          limit=${this.limit}
          @search-select=${this._select}
        ></lc-search>
        <div class="command-palette-footer">
          <span><lc-kbd>↑</lc-kbd><lc-kbd>↓</lc-kbd> ${lcText(TAG, "navigate")}</span>
          <span><lc-kbd>↵</lc-kbd> ${lcText(TAG, "open")}</span>
          <span><lc-kbd>esc</lc-kbd> ${lcText(TAG, "close")}</span>
        </div>
      </lc-modal>
    `;
  },
});
