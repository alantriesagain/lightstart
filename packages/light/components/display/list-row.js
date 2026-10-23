import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { navigation } from "@bootstrapp/light/navigation";

export default defineComponent({
  tag: "lc-list-row",
  style: true,
  props: {
    href: "",
    icon: "",
    iconSize: "18",
    label: "",
    hint: "",
    meta: "",
    chevron: false,
    flat: false,
    unread: false,
    wrap: false,
    size: T.string({ defaultValue: "md", enum: ["sm", "md", "lg"] }),
    disabled: false,
    selected: T.boolean(),
    static: false,
  },
  events: {
    select: T.any(),
  },
  /** @param {MouseEvent} e */
  _click(e) {
    if (this.disabled) return void e.preventDefault();
    if (this.href) navigation.click(e);
    this.$emit("select", { href: this.href });
  },
  render() {
    const body = html`
      <slot name="leading">
        ${this.icon
          ? html`<span part="lc-list-row-badge"><lc-icon name=${this.icon} size=${this.iconSize}></lc-icon></span>`
          : ""}
      </slot>
      <span part="lc-list-row-text">
        <slot name="label"><span part="lc-list-row-label">${this.label}</span></slot>
        ${this.hint ? html`<span part="lc-list-row-hint">${this.hint}</span>` : ""}
        ${this.wrap && this.meta ? html`<span part="lc-list-row-meta">${this.meta}</span>` : ""}
      </span>
      <slot name="trailing">
        ${!this.wrap && this.meta ? html`<span part="lc-list-row-meta">${this.meta}</span>` : ""}
        ${this.unread ? html`<lc-badge part="lc-list-row-dot" dot></lc-badge>` : ""}
        ${this.chevron ? html`<lc-icon part="lc-list-row-chevron" name="chevron-right" size="17"></lc-icon>` : ""}
      </slot>`;

    if (this.static) return html`<div part="lc-list-row-row" aria-current=${this.selected ? "true" : nothing}>${body}</div>`;
    return this.href
      ? html`<a part="lc-list-row-row" href=${navigation.href(this.href)} aria-current=${this.selected ? "true" : nothing} @click=${(/** @type {MouseEvent} */ e) => this._click(e)}>${body}</a>`
      : html`<button part="lc-list-row-row" type="button" ?disabled=${this.disabled} aria-current=${this.selected ? "true" : nothing} @click=${(/** @type {MouseEvent} */ e) => this._click(e)}>${body}</button>`;
  },
});

/**
 * List Row Component
 *
 * @component
 * @category display
 * @tag lc-list-row
 *
 * A row that leads somewhere: a leading badge, a label with an optional second
 * line, and something on the right. `lc-list-item` is a bare `<li>`; this is
 * the chrome, so an app stops rewriting the same flex row for settings, a
 * library index and a menu.
 *
 * Renders an `<a>` when given `href` and a `<button>` otherwise, so the element
 * matches what the row actually does, and routes the href rather than leaving
 * the page. Every part is themeable, and `leading`, `label` and `trailing` are
 * slots when the defaults are not enough. `flat` drops the row's own surface
 * and border, for a list already sitting on a card. `unread` marks the row as not yet read:
 * a dot before the chevron and a heavier label, both restyleable through
 * `[part~=lc-list-row-dot]` and `--lc-list-row-unread-*`. `wrap` lets the label and the
 * hint run onto as many lines as they need instead of truncating to one, and
 * moves the meta under them so the text keeps the row's width: for a row whose
 * text is the content, a message or a notice, rather than a name. `selected`
 * tints the row (`--lc-list-row-selected-background`, and a border through
 * `--lc-list-row-selected-border-color`) and marks it `aria-current`, for the
 * open entry of a master-detail list. `static` makes the row a plain box: a
 * `<div>` that leads nowhere and emits nothing, for a line of information or a
 * row whose control sits in its `trailing` slot, so a button never nests in a
 * button.
 *
 * @example
 * // A settings row
 * ```html
 * <lc-list-row href="/devices" icon="video" label="Devices" hint="Rack cam" chevron></lc-list-row>
 * ```
 *
 * @example
 * // A row nobody has read yet
 * ```html
 * <lc-list-row icon="bell" label="Ana asked to join" hint="Beach in Ipanema" meta="2h" unread></lc-list-row>
 * ```
 *
 * @example
 * // A custom leading thumbnail and a trailing control, on a row that is not itself a control
 * ```html
 * <lc-list-row static label="Barbell Bench Press" meta="3 × 5">
 *   <img slot="leading" src=${thumb} alt="">
 *   <lc-button slot="trailing" iconOnly icon="x" ghost></lc-button>
 * </lc-list-row>
 * ```
 */
