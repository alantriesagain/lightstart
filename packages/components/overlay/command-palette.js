import { html, nothing } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import { withClickOutside } from "@lightstart/components/mixins/click-outside.js";
import { withEscapeKey } from "@lightstart/components/mixins/escape-key.js";
import { anchorPosition } from "./anchor.js";
import { matchesShortcut, parseShortcut, shortcutKeys } from "../utils/shortcut.js";
import { lcText } from "../utils/text.js";
import { env } from "@lightstart/light/env";
/** @import { PaletteAnchor, Prop, SearchDoc, SearchElement } from "../types.ts" */

const TAG = "lc-command-palette";
const ANCHOR_OFFSET_PX = 4;

/** @param {EventTarget | null} target */
const isEditable = (target) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export default defineComponent({
  mixins: [withClickOutside({ events: "pointerdown" }), withEscapeKey],
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
    anchor: /** @type {Prop<PaletteAnchor | null>} */ (
      T.union({ types: [T.string(), T.object()], attribute: true, defaultValue: null })
    ),
    _placementStop: /** @type {Prop<(() => void) | null>} */ (
      T.object({ reactive: false, defaultValue: null })
    ),
    _restoreOnClose: T.boolean({ reactive: false, defaultValue: false }),
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
    if (typeof document === "undefined") return;
    document.addEventListener("keydown", onKey);
    this.$own(() => {
      document.removeEventListener("keydown", onKey);
      this._stopPlacement();
    });
  },
  firstUpdated() {
    if (this._anchored() && this.open) {
      this._startPlacement();
      this._focusSearch();
      this._placePanel();
    }
  },
  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    const toggled = changedProps.has("open") && this._anchored();
    if (toggled && this.open) {
      this._startPlacement();
      this._focusSearch();
      this._placePanel();
    } else if (toggled) {
      this._stopPlacement();
      if (this._restoreOnClose) {
        this._restoreOnClose = false;
        this._restoreAnchorFocus();
      }
    }
    if (changedProps.has("anchor") && this.open && this._anchored()) this._placePanel();
  },
  _anchored() {
    return Boolean(this.anchor);
  },
  /** @returns {HTMLElement | null} */
  _resolveAnchor() {
    const anchor = this.anchor;
    if (anchor instanceof HTMLElement) return anchor;
    if (typeof anchor !== "string" || !anchor) return null;
    const doc = this.ownerDocument;
    const byId = doc.getElementById(anchor);
    if (byId) return byId;
    try {
      const found = doc.querySelector(anchor);
      return found instanceof HTMLElement ? found : null;
    } catch {
      return null;
    }
  },
  _placePanel() {
    const panel = /** @type {HTMLElement | null} */ (this.querySelector("[part~=lc-command-palette-panel]"));
    const anchor = this._resolveAnchor();
    if (!panel || !anchor || !this.open) return;
    const trigger = anchor.getBoundingClientRect();
    panel.style.minWidth = `${trigger.width}px`;
    const box = panel.getBoundingClientRect();
    const { top, left } = anchorPosition({
      trigger,
      floating: { width: box.width, height: box.height },
      side: "bottom",
      align: "start",
      offset: ANCHOR_OFFSET_PX,
      viewport: { width: env.width, height: env.height },
    });
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
  },
  _startPlacement() {
    if (this._placementStop) return;
    const onScroll = () => this._placePanel();
    globalThis.addEventListener("scroll", onScroll, true);
    const offEnv = env.subscribe(() => this._placePanel());
    this._placementStop = () => {
      globalThis.removeEventListener("scroll", onScroll, true);
      offEnv();
      this._placementStop = null;
    };
  },
  _stopPlacement() {
    this._placementStop?.();
  },
  _restoreAnchorFocus() {
    const target = this._resolveAnchor() || /** @type {HTMLElement | null} */ (this.querySelector(".command-palette-trigger"));
    target?.focus();
  },
  onEscape() {
    if (!this._anchored() || !this.open) return;
    this._restoreOnClose = true;
    this.open = false;
  },
  /** @param {Event} e */
  onClickOutside(e) {
    if (!this._anchored() || !this.open) return;
    const anchor = this._resolveAnchor();
    if (anchor && e.composedPath().includes(anchor)) return;
    this.open = false;
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
  /** @param {string} placeholder */
  _search(placeholder) {
    return html`
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
    `;
  },
  _footer() {
    return html`
      <div class="command-palette-footer">
        <span><lc-kbd>↑</lc-kbd><lc-kbd>↓</lc-kbd> ${lcText(TAG, "navigate")}</span>
        <span><lc-kbd>↵</lc-kbd> ${lcText(TAG, "open")}</span>
        <span><lc-kbd>esc</lc-kbd> ${lcText(TAG, "close")}</span>
      </div>
    `;
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
      ${this._anchored()
        ? html`
            <div part="lc-command-palette-panel" class="command-palette-panel" role="dialog" aria-label=${placeholder} ?hidden=${!this.open}>
              ${this._search(placeholder)}
              ${this._footer()}
            </div>
          `
        : html`
            <lc-modal class="command-palette-modal" size="sm" ?open=${this.open} @modal-open=${this._focusSearch} @modal-close=${this._closed}>
              ${this._search(placeholder)}
              ${this._footer()}
            </lc-modal>
          `}
    `;
  },
});

/**
 * Command Palette Component
 *
 * @component
 * @category overlay
 * @tag lc-command-palette
 *
 * A search over the app's places, opened from anywhere by a shortcut or from
 * its own trigger, shown in a dialog with the keys that drive it. `compact`
 * shrinks the trigger to its icon for a narrow header. An `anchor` opens it as
 * a non-modal panel under that element or selector instead, without a backdrop
 * or a focus trap; Escape closes it and hands focus back to the anchor.
 *
 * @example
 * ```html
 * <lc-command-palette shortcut="mod+k" .docs=${docs} .groups=${["Components", "Pages"]}></lc-command-palette>
 * ```
 *
 * @example
 * ```html
 * <lc-command-palette anchor="#app-search" hide-trigger .docs=${docs}></lc-command-palette>
 * ```
 */
