import { html, nothing } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";
import { withClickOutside } from "@bootstrapp/light/components/mixins/click-outside.js";
import { withOverlay } from "@bootstrapp/light/components/mixins/overlay.js";
import { groupDocs, matchDocs } from "@bootstrapp/light/components/form/search-match.js";
import { nextIndex } from "../utils/roving.js";
import T from "@bootstrapp/light/types";
import { lcText } from "../utils/text.js";
import { navigation } from "@bootstrapp/light/navigation";

/** @import { Prop, SearchDoc } from "../types.ts" */
/** @import { TemplateValue } from "@bootstrapp/light/html" */

export default defineComponent({
  mixins: [withOverlay(), withClickOutside()],
  tag: "lc-search",
  style: true,
  props: {
    placeholder: "",
    query: "",
    open: false,
    active: -1,
    limit: 8,
    docs: /** @type {Prop<SearchDoc[]>} */ (T.array({ defaultValue: [], attribute: false })),
    suggestions: /** @type {Prop<SearchDoc[]>} */ (T.array({ defaultValue: [], attribute: false })),
    groups: /** @type {Prop<string[]>} */ (T.array({ defaultValue: [] })),
    collapsible: false,
    expanded: false,
    inline: false,
    autofocus: false,
    iconPosition: T.string({ defaultValue: "left", enum: ["left", "right"] }),
    leading: /** @type {Prop<(() => TemplateValue) | null>} */ (T.object({ attribute: false, defaultValue: null, hasChanged: () => false })),
    trailing: /** @type {Prop<(() => TemplateValue) | null>} */ (T.object({ attribute: false, defaultValue: null, hasChanged: () => false })),
    renderResult: /** @type {Prop<((doc: SearchDoc) => TemplateValue) | null>} */ (T.object({ attribute: false, defaultValue: null, hasChanged: () => false })),
    _expanding: T.boolean({ reactive: false, defaultValue: false }),
  },
  events: {
    "search-select": T.object(),
    "search-input": T.string(),
    "search-expand": T.object({ expanded: T.boolean() }),
  },

  firstUpdated() {
    this.addEventListener("focusout", () => this._onFocusOut());
    if (this.autofocus) this.focusInput();
  },

  _shown() {
    return this.query.trim()
      ? matchDocs(this.docs, this.query, this.limit)
      : this.suggestions.slice(0, this.limit);
  },

  _grouped() {
    return groupDocs(this._shown(), this.groups);
  },

  _flat() {
    return this._grouped().flatMap((g) => g.docs);
  },

  _worthOpening() {
    return !!this.query.trim() || this.suggestions.length > 0;
  },

  _showPanel() {
    if (this.inline) return !!this.query.trim() || this._flat().length > 0;
    return this.open && (!!this.query.trim() || this._flat().length > 0);
  },

  focusInput() {
    /** @type {HTMLInputElement | null} */ (this.querySelector("input"))?.focus();
  },

  async expand() {
    if (this.expanded) return;
    this._expanding = true;
    this.expanded = true;
    this.open = this.suggestions.length > 0;
    this.$emit("search-expand", { expanded: true });
    await this.$requestUpdate();
    this.focusInput();
    this._expanding = false;
  },

  collapse() {
    if (!this.expanded) return;
    this.expanded = false;
    this.open = false;
    this.active = -1;
    this.$emit("search-expand", { expanded: false });
  },

  _clear() {
    if (!this.query) return this.collapse();
    this.query = "";
    this.active = -1;
    this.open = this.suggestions.length > 0;
    this.$emit("search-input", this.query);
    this.focusInput();
  },

  /** @param {SearchDoc} doc */
  _select(doc) {
    this.open = false;
    this.active = -1;
    this.$emit("search-select", doc);
    if (!this.collapsible || !doc.href) return;
    this.query = "";
    this.collapse();
  },

  /** @param {Event} e */
  _onInput(e) {
    e.stopPropagation();
    this.query = /** @type {HTMLInputElement} */ (e.target).value;
    this.open = this._worthOpening();
    this.active = -1;
    this.$emit("search-input", this.query);
  },

  _onFocus() {
    this.open = this._worthOpening();
  },

  _onFocusOut() {
    if (!this.collapsible || !this.expanded || this._expanding) return;
    setTimeout(() => {
      if (!this.isConnected || !this.expanded || this._expanding || this.query.trim()) return;
      if (this.contains(this.ownerDocument.activeElement)) return;
      this.collapse();
    }, 0);
  },

  /** @param {KeyboardEvent} e */
  _onKeydown(e) {
    const flat = this._flat();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (e.key === "ArrowDown") this.open = this._worthOpening();
      const moved = nextIndex(e.key, this.active, flat.length);
      if (moved !== null) this.active = moved;
    } else if (e.key === "Enter") {
      const doc = flat[this.active] || flat[0];
      if (!doc) return;
      this._select(doc);
      if (doc.href) navigation.go(doc.href);
    } else if (e.key === "Escape") this._escape();
  },

  _escape() {
    if (this.inline) return;
    if (this.open) return void (this.open = false);
    if (this.collapsible) this.collapse();
  },

  onEscape() {
    this._escape();
  },

  onClickOutside() {
    if (this.inline) return;
    if (this.open) this.open = false;
    if (this.collapsible && this.expanded && !this.query.trim()) this.collapse();
  },

  /**
   * @param {SearchDoc} doc
   * @param {number} index
   */
  _renderResult(doc, index) {
    const body = this.renderResult
      ? this.renderResult(doc)
      : html`
        <span class="search-result-text">
          <span class="search-result-title">${doc.title}</span>
          ${doc.hint ? html`<span class="search-result-hint">${doc.hint}</span>` : ""}
        </span>
      `;
    const classes = `search-result ${index === this.active ? "active" : ""}`;
    const activate = () => { this.active = index; };
    return doc.href
      ? html`
        <a
          class=${classes}
          href=${navigation.href(String(doc.href))}
          @click=${() => this._select(doc)}
          @mouseenter=${activate}
        >${body}</a>
      `
      : html`
        <button
          type="button"
          class=${classes}
          @click=${() => this._select(doc)}
          @mouseenter=${activate}
        >${body}</button>
      `;
  },

  _trigger() {
    return html`
      <button
        type="button"
        class="search-trigger"
        part="lc-search-trigger"
        aria-expanded="false"
        aria-label=${this.placeholder || lcText("lc-search", "expand")}
        @click=${() => this.expand()}
      >
        <lc-icon name="search"></lc-icon>
      </button>
    `;
  },

  _field() {
    const grouped = this._grouped();
    let index = -1;
    return html`
      <div class="search-wrapper" part="lc-search-field">
        <lc-icon name="search" class="search-icon"></lc-icon>
        <input
          type="search"
          class="search-input"
          .value=${this.query}
          placeholder=${this.placeholder || lcText("lc-search", "placeholder")}
          autocomplete="off"
          role="combobox"
          aria-expanded=${this.open ? "true" : "false"}
          @input=${(e) => this._onInput(e)}
          @focus=${() => this._onFocus()}
          @keydown=${(/** @type {KeyboardEvent} */ e) => this._onKeydown(e)}
        />
        ${this.collapsible
          ? html`
            <button
              type="button"
              class="search-clear"
              part="lc-search-clear"
              aria-label=${lcText("lc-search", this.query ? "clear" : "collapse")}
              @click=${() => this._clear()}
            >
              <lc-icon name="x"></lc-icon>
            </button>
          `
          : nothing}
        ${this._showPanel()
          ? html`
            <div class="search-dropdown" role="listbox">
              ${grouped.length === 0
                ? html`<div class="search-empty">${lcText("lc-search", "noResults")}</div>`
                : grouped.map(
                    (g) => html`
                      <div class="search-group-label">${g.group}</div>
                      ${g.docs.map((/** @type {SearchDoc} */ doc) => {
                        index += 1;
                        return this._renderResult(doc, index);
                      })}
                    `,
                  )}
            </div>
          `
          : nothing}
      </div>
    `;
  },

  render() {
    const collapsed = this.collapsible && !this.expanded;
    const body = collapsed ? this._trigger() : this._field();
    if (!this.leading && !this.trailing) return body;
    return html`
      <lc-join class="search-join" @click=${collapsed ? () => this.expand() : null}>
        ${this.leading ? html`<div class="search-aside" part="lc-search-leading"><div class="search-aside-body">${this.leading()}</div></div>` : nothing}
        ${body}
        ${this.trailing ? html`<div class="search-aside" part="lc-search-trailing"><div class="search-aside-body">${this.trailing()}</div></div>` : nothing}
      </lc-join>
    `;
  },
});

/**
 * Search Component
 *
 * @component
 * @category form
 * @tag lc-search
 *
 * An input with a grouped-results dropdown combobox. Callers pass a flat
 * `docs` array of `{ id, group, title, hint?, href? }`; matching is a simple
 * case-insensitive includes over title+hint, capped per group by `limit`.
 * `groups` optionally orders the group sections, `suggestions` are the docs
 * shown before anything is typed, and `renderResult` draws a row's body when
 * title and hint are not enough. Results with `href` render as real anchors;
 * every choice emits `search-select` with the chosen doc, and typing emits
 * `search-input` with the query. Arrow keys and Enter navigate; Escape and
 * clicking outside close the dropdown.
 *
 * `leading` and `trailing` put content beside the field, at which point the
 * component wraps itself in a `lc-join` and the three read as one control.
 * With `collapsible` the field starts as an icon and opens on click, and the
 * panes beside it fold away to give it the room; `iconPosition` moves the
 * magnifier to the other end.
 *
 * @example
 * // Basic grouped search
 * ```js
 * html`<lc-search
 *   placeholder="Search docs..."
 *   .docs=${[
 *     { id: "1", group: "Guides", title: "Getting Started", href: "/guides/start" },
 *     { id: "2", group: "Guides", title: "Routing", hint: "URL patterns", href: "/guides/routing" },
 *     { id: "3", group: "API", title: "defineComponent", href: "/api/define-component" },
 *   ]}
 * ></lc-search>`
 * ```
 *
 * @example
 * // A wordmark joined to a search that opens on tap
 * ```js
 * html`<lc-search
 *   collapsible
 *   .leading=${() => html`<a href="/">meetup<span class="text-primary">.rio</span></a>`}
 *   .docs=${docs}
 *   .suggestions=${recent}
 *   @search-expand=${(e) => closeThePanelBelow(e.detail.expanded)}
 * ></lc-search>`
 * ```
 *
 * @example
 * // Event-driven selection (no hrefs)
 * ```js
 * html`<lc-search
 *   .docs=${commands.map((c) => ({ id: c.id, group: "Commands", title: c.label }))}
 *   @search-select=${(e) => runCommand(e.detail.id)}
 *   @search-input=${(e) => track(e.detail)}
 * ></lc-search>`
 * ```
 *
 * @example
 * // Explicit group order, per-group cap, and rows the host draws
 * ```js
 * html`<lc-search
 *   .docs=${docs}
 *   .groups=${["Places", "Events", "Guides"]}
 *   .renderResult=${(doc) => html`<img src=${doc.image} alt="" /><span>${doc.title}</span>`}
 *   limit="4"
 * ></lc-search>`
 * ```
 */
