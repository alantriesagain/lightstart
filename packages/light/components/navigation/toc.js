import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";
/** @import { Prop, TocItem } from "../types.ts" */

const TAG = "lc-toc";

/**
 * Table of Contents Component
 *
 * @component
 * @category navigation
 * @tag lc-toc
 *
 * The headings of the page it sits beside, as links, with the one on screen
 * marked. Items name headings by id; the component watches those elements and
 * follows the reader's scroll.
 *
 * @example
 * ```html
 * <lc-toc .items=${[{ id: "examples", label: "Examples" }, { id: "basic", label: "Basic", level: 2 }]}></lc-toc>
 * ```
 */
export default defineComponent({
  tag: "lc-toc",
  style: true,
  props: {
    items: /** @type {Prop<TocItem[]>} */ (T.array({ attribute: false, defaultValue: [] })),
    title: "",
    active: "",
    depth: 3,
    root: "",
    offset: 0,
    _current: "",
    _observer: /** @type {Prop<IntersectionObserver | null>} */ (T.object({ attribute: false, defaultValue: null, reactive: false })),
    _watched: T.string({ defaultValue: "", reactive: false }),
  },
  events: {
    "toc-change": T.object(),
  },
  _shown() {
    return this.items.filter((item) => (item.level ?? 1) <= this.depth);
  },
  _watch() {
    const ids = this._shown().map((item) => item.id).join(",");
    if (ids === this._watched) return;
    this._watched = ids;
    this._observer?.disconnect();
    if (typeof IntersectionObserver === "undefined" || !ids) return;
    const root = this.root ? document.querySelector(this.root) : null;
    /** @type {Map<string, boolean>} */
    const visible = new Map();
    this._observer = new IntersectionObserver((entries) => {
      for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
      const first = this._shown().find((item) => visible.get(item.id));
      if (first && first.id !== this._current) {
        this._current = first.id;
        this.$emit("toc-change", { id: first.id });
      }
    }, { root, rootMargin: `-${this.offset}px 0px -60% 0px`, threshold: 0 });
    for (const item of this._shown()) {
      const target = document.getElementById(item.id);
      if (target) this._observer.observe(target);
    }
  },
  connected() {
    this.$own(() => this._observer?.disconnect());
  },
  updated() {
    this._watch();
  },
  render() {
    const on = this.active || this._current;
    return html`
      <nav class="toc" aria-label=${this.title || lcText(TAG, "title")}>
        <span class="toc-title">${this.title || lcText(TAG, "title")}</span>
        <ul class="toc-list">
          ${this._shown().map(
            (item) => html`
              <li class="toc-item" data-level=${item.level ?? 1}>
                <a class="toc-link" href=${`#${item.id}`} aria-current=${item.id === on ? "location" : nothing}>${item.label}</a>
              </li>
            `,
          )}
        </ul>
      </nav>
    `;
  },
});
