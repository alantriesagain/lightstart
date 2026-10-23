import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

/** @import { Prop, PageHeaderCrumb } from "../types.ts" */

export default defineComponent({
  tag: "lc-page-header",
  style: true,
  props: {
    crumbs: /** @type {Prop<PageHeaderCrumb[]>} */ (T.array({ defaultValue: [] })),
    title: T.string(),
    subtitle: T.string(),
    _hasTools: T.boolean({ attribute: false }),
  },
  /** @param {Event} e */
  _onToolsChange(e) {
    const slot = /** @type {HTMLSlotElement} */ (e.target);
    this._hasTools = slot.childNodes.length > 0;
  },
  firstUpdated() {
    this._hasTools = this.querySelector('slot[name="tools"]')?.hasAttribute("data-assigned") ?? false;
  },
  render() {
    const crumbs = this.crumbs.map((crumb, index) => ({
      text: crumb.label,
      href: crumb.href ?? null,
      isLast: index === this.crumbs.length - 1,
    }));
    return html`
      <div part="lc-page-header-row" class="row">
        <slot name="start"></slot>
        <div part="lc-page-header-heading" class="heading">
          ${
            crumbs.length
              ? html`<lc-breadcrumbs part="lc-page-header-crumbs" size="sm" .items=${crumbs}></lc-breadcrumbs>
                <span part="lc-page-header-crumb-separator" class="crumb-separator" aria-hidden="true">/</span>`
              : ""
          }
          <h1 part="lc-page-header-title" class="title"><slot name="title">${this.title}</slot></h1>
          ${this.subtitle ? html`<span part="lc-page-header-subtitle" class="subtitle">${this.subtitle}</span>` : ""}
        </div>
        <div part="lc-page-header-spacer" class="spacer"></div>
        <div part="lc-page-header-controls" class="controls"><slot name="controls"></slot></div>
        ${this._hasTools ? html`<span part="lc-page-header-divider" class="divider"></span>` : ""}
        <div part="lc-page-header-tools" class="tools"><slot name="tools" @slotchange=${(e) => this._onToolsChange(e)}></slot></div>
      </div>
    `;
  },
});

/**
 * Page Header Component
 *
 * @component
 * @category app
 * @tag lc-page-header
 *
 * The one row at the top of a page: crumbs, the title, then the page's controls
 * and, past a divider, its tools.
 *
 * @slot start - Before the crumbs (a menu button, a back arrow)
 * @slot title - Replaces the title text
 * @slot controls - Right of the spacer (filters, a scope dropdown)
 * @slot tools - After the divider (icon buttons, the primary action)
 *
 * @part row - The row
 * @part heading - Crumbs, title and subtitle
 * @part crumbs - The breadcrumbs
 * @part title - The title
 * @part subtitle - The subtitle
 * @part controls - The controls wrapper
 * @part divider - The rule between controls and tools, drawn only when tools are slotted
 * @part tools - The tools wrapper
 *
 * @example
 * ```html
 * <lc-page-header title="Overview" .crumbs=${[{ label: "Workspace", href: "/w" }, { label: "Projects" }]}>
 *   <lc-button slot="tools" size="sm" primary>New</lc-button>
 * </lc-page-header>
 * ```
 */
