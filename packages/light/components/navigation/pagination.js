import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

/** @import { PagerLink, Prop } from "../types.ts" */

const TAG = /** @type {const} */ ("lc-pagination");

export default defineComponent({
  tag: "lc-pagination",
  props: {
    current: 1,
    total: 1,
    siblings: 1,
    showFirst: true,
    showLast: true,
    showPrevNext: true,
    size: T.string({
      defaultValue: "md",
      enum: ["sm", "md", "lg"],
    }),
    variant: T.string({
      defaultValue: "default",
      enum: ["default", "simple", "loadmore", "pager"],
    }),
    previousLink: /** @type {Prop<PagerLink | null>} */ (T.object({ attribute: false, defaultValue: null })),
    nextLink: /** @type {Prop<PagerLink | null>} */ (T.object({ attribute: false, defaultValue: null })),
    loadmoreText: "",
    hasMore: true,
    hrefFor: /** @type {Prop<((page: number) => string) | null>} */ (T.function()),
  },
  style: true,

  /** @param {number} page */
  goToPage(page) {
    if (page < 1 || page > this.total || page === this.current) return;
    this.current = page;
    this.$emit("change", { page: this.current });
  },

  next() {
    this.goToPage(this.current + 1);
  },

  prev() {
    this.goToPage(this.current - 1);
  },

  _loadMore() {
    this.$emit("loadmore");
  },

  _getPageNumbers() {
    /** @type {(number | "...")[]} */
    const pages = [];
    const leftSibling = Math.max(1, this.current - this.siblings);
    const rightSibling = Math.min(this.total, this.current + this.siblings);

    if (this.showFirst && leftSibling > 1) {
      pages.push(1);
      if (leftSibling > 2)
        pages.push("...");

    }

    for (let i = leftSibling; i <= rightSibling; i++)
      pages.push(i);

    if (this.showLast && rightSibling < this.total) {
      if (rightSibling < this.total - 1)
        pages.push("...");

      pages.push(this.total);
    }

    return pages;
  },

  /**
   * @param {number} page
   * @param {{ cls?: string, label: string, content: import("@bootstrapp/light/html").TemplateValue, disabled?: boolean }} arg
   */
  _ctrl(page, { cls = "", label, content, disabled = false }) {
    const active = page === this.current;
    const klass = `pagination-button ${cls} ${active ? "active" : ""} ${disabled ? "disabled" : ""}`.replace(/\s+/g, " ").trim();
    if (this.hrefFor) {
      if (disabled)
        return html`<span class=${klass} aria-label=${label} aria-disabled="true">${content}</span>`;
      return html`<lc-link class=${klass} href=${this.hrefFor(page)} aria-label=${label} aria-current=${active ? "page" : nothing}>${content}</lc-link>`;
    }
    return html`<button class=${klass} ?disabled=${disabled} @click=${() => this.goToPage(page)} aria-label=${label} aria-current=${active ? "page" : "false"}>${content}</button>`;
  },

  renderDefault() {
    const pages = this._getPageNumbers();
    const hasPrev = this.current > 1;
    const hasNext = this.current < this.total;

    return html`
      <nav class="pagination" role="navigation" aria-label=${lcText(TAG, "nav")}>
        <ul class="pagination-list">
          ${this.showPrevNext
            ? html`<li>${this._ctrl(this.current - 1, { cls: "prev", label: lcText(TAG, "prevPage"), disabled: !hasPrev, content: html`<lc-icon name="chevron-left" size="14"></lc-icon>` })}</li>`
            : nothing}

          ${pages.map((page) =>
            page === "..."
              ? html`<li><span class="pagination-ellipsis">&hellip;</span></li>`
              : html`<li>${this._ctrl(page, { label: lcText(TAG, "page", { page }), content: page })}</li>`,
          )}

          ${this.showPrevNext
            ? html`<li>${this._ctrl(this.current + 1, { cls: "next", label: lcText(TAG, "nextPage"), disabled: !hasNext, content: html`<lc-icon name="chevron-right" size="14"></lc-icon>` })}</li>`
            : nothing}
        </ul>
      </nav>
    `;
  },

  renderSimple() {
    const hasPrev = this.current > 1;
    const hasNext = this.current < this.total;

    return html`
      <nav class="pagination" role="navigation" aria-label=${lcText(TAG, "nav")}>
        <div class="pagination-simple">
          ${this._ctrl(this.current - 1, { cls: "prev", label: lcText(TAG, "prevPage"), disabled: !hasPrev, content: html`<lc-icon name="chevron-left" size="14"></lc-icon><span>${lcText(TAG, "prev")}</span>` })}
          <span class="pagination-info">${lcText(TAG, "pageOf", { current: this.current, total: this.total })}</span>
          ${this._ctrl(this.current + 1, { cls: "next", label: lcText(TAG, "nextPage"), disabled: !hasNext, content: html`<span>${lcText(TAG, "next")}</span><lc-icon name="chevron-right" size="14"></lc-icon>` })}
        </div>
      </nav>
    `;
  },

  renderLoadmore() {
    return html`
      <div class="pagination-loadmore">
        <button
          class="pagination-button loadmore"
          ?disabled=${!this.hasMore}
          @click=${this._loadMore}
        >
          ${this.loadmoreText || lcText(TAG, "loadMore")}
        </button>
      </div>
    `;
  },

  /**
   * @param {PagerLink | null} link
   * @param {"previous" | "next"} side
   */
  _pagerLink(link, side) {
    const icon = side === "previous" ? "chevron-left" : "chevron-right";
    const hint = lcText(TAG, side === "previous" ? "prevPage" : "nextPage");
    if (!link) return html`<span class="pagination-pager-link ${side}" aria-disabled="true"></span>`;
    return html`
      <lc-link class="pagination-pager-link ${side}" href=${link.href} aria-label=${`${hint}: ${link.label}`}>
        ${side === "previous" ? html`<lc-icon name=${icon} size="16"></lc-icon>` : nothing}
        <span class="pagination-pager-text">
          <span class="pagination-pager-hint">${link.hint || hint}</span>
          <span class="pagination-pager-label">${link.label}</span>
        </span>
        ${side === "next" ? html`<lc-icon name=${icon} size="16"></lc-icon>` : nothing}
      </lc-link>
    `;
  },

  renderPager() {
    return html`
      <nav class="pagination pagination-pager" role="navigation" aria-label=${lcText(TAG, "nav")}>
        ${this._pagerLink(this.previousLink, "previous")}
        ${this._pagerLink(this.nextLink, "next")}
      </nav>
    `;
  },

  render() {
    if (this.variant === "pager") return this.renderPager();
    if (this.variant === "simple") return this.renderSimple();
    if (this.variant === "loadmore") return this.renderLoadmore();
    return this.renderDefault();
  },
});

/**
 * Pagination Component
 *
 * @component
 * @category navigation
 * @tag lc-pagination
 *
 * Pagination controls for navigating through pages of content.
 * Supports numbered pages, simple prev/next, and load more variants.
 *
 * @example Basic Pagination
 * ```html
 * <lc-pagination current="3" total="10"></lc-pagination>
 * ```
 *
 * @example Simple Prev/Next
 * ```html
 * <lc-pagination variant="simple" current="5" total="20"></lc-pagination>
 * ```
 *
 * @example Load More
 * ```html
 * <lc-pagination variant="loadmore" loadmore-text="Show More Results"></lc-pagination>
 * ```
 *
 * @example Size Variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 1rem;">
 *   <lc-pagination size="sm" current="3" total="7"></lc-pagination>
 *   <lc-pagination size="md" current="3" total="7"></lc-pagination>
 *   <lc-pagination size="lg" current="3" total="7"></lc-pagination>
 * </div>
 * ```
 *
 * @example Many Pages with Ellipsis
 * ```html
 * <lc-pagination current="15" total="50" siblings="2"></lc-pagination>
 * ```
 *
 * @example With Event Handling
 * ```js
 * html`<lc-pagination
 *   current="1"
 *   total="20"
 *   @change=${(e) => console.log('Go to page', e.detail.page)}
 * ></lc-pagination>`
 * ```
 */
