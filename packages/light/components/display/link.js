/**
 * App Link Component
 * Core link component for navigation and routing
 * Popup behaviors (tooltip, dropdown, etc.) moved to separate lc components
 */
import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";

import { defineComponent } from "@bootstrapp/light";
import { isActivePath } from "../utils/active-path.js";
import { navigation } from "@bootstrapp/light/navigation";

export default defineComponent({
  tag: "lc-link",
  style: true,
  props: {
    content: T.object(),
    external: T.boolean(),
    skipRoute: T.boolean(),
    hideLabel: T.boolean(),
    disabled: T.boolean(),
    name: T.string(),
    alt: T.string(),
    label: T.string(),
    type: T.string(),
    href: T.string(),
    rel: T.string(),
    related: T.string(),
    ref: T.string(),
    icon: T.string(),
    iconSize: "md",
    tooltip: T.string(),
    tooltipPosition: T.string({ defaultValue: "top", enum: ["top", "bottom", "left", "right"] }),
    active: T.boolean(),
    activeMatch: T.string(),
    exact: T.boolean(),
    confirmation: T.string(),
    popovertarget: T.string(),
    popovertargetaction: T.string(),

    tabindex: T.string(),

    ariaLabel: T.string(),
    ariaPressed: T.string(),
  },
  _isActive() {
    return isActivePath(navigation.path(), this.activeMatch || this.href, this.exact);
  },
  connected() {
    this.addEventListener("click", this._forwardHostClick);
    this.$own(() => this.removeEventListener("click", this._forwardHostClick));
    if (!this.activeMatch && !this.exact) return;
    this.active = this._isActive();
    this.$own(navigation.subscribe(() => {
      this.active = this._isActive();
    }));
  },
  /**
   * A click dispatched on the host itself (`el.click()`, a synthetic one in a
   * test) never reaches the anchor inside it, so it is handed on. The
   * forwarded event does not bubble, so a `@click` listener on the host still
   * fires exactly once.
   * @param {MouseEvent} e
   */
  _forwardHostClick(e) {
    if (e.target !== this) return;
    const anchor = this.querySelector(":scope > [part~=lc-link-anchor]");
    if (!anchor) return;
    anchor.dispatchEvent(new MouseEvent("click", { bubbles: false, cancelable: true, detail: 1 }));
  },

  /** @param {Event} e */
  _handlePopoverTarget(e) {
    if (!this.popovertarget) return false;

    const target = /** @type {(HTMLElement & { toggle: (t?: Element) => void, _open: (t?: Element) => void, _close: () => void }) | null} */ (
      document.getElementById(this.popovertarget)
    );
    if (!target || typeof target.toggle !== "function") return false;

    e.preventDefault();
    e.stopPropagation();

    const triggerElement = this;

    const action = this.popovertargetaction || "toggle";
    if (action === "toggle")
      target.toggle(triggerElement);
     else if (action === "show")
      target._open(triggerElement);
     else if (action === "hide")
      target._close();

    return true;
  },

  /** @param {MouseEvent} e */
  _defaultOnClick(e) {
    if (this.disabled) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    if (this._handlePopoverTarget(e))
      return;

    if (this.href && !this.skipRoute) {
      const handled = navigation.click(e, { external: this.external });
      if (handled) return;
    }

    if (!this.href && this.type === "submit") {
      this.closest("form")?.requestSubmit();
      return;
    }

    if (this.confirmation && this.type !== "submit" && !globalThis.confirm(this.confirmation)) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  _getHref() {
    if (!this.href) return this.href;
    let href = this.href;
    if (!this.external) href = navigation.href(href);
    if (this.ref) {
      const sep = href.includes("?") ? "&" : "?";
      href = `${href}${sep}ref=${encodeURIComponent(this.ref)}`;
    }
    return href;
  },
  firstUpdated() {
    const anchor = /** @type {HTMLElement | null} */ (this.querySelector(":scope > [part~=lc-link-anchor]"));
    if (!anchor) return;
    anchor.addEventListener("click", this._defaultOnClick);
  },
  render() {
    const content = html`
      ${this.icon ? html`<lc-icon name=${this.icon} size=${this.iconSize} part="lc-link-icon"></lc-icon>` : null}
      <slot></slot>
      ${this.hideLabel ? null : this.label}
      ${this.tooltip ? html`<lc-tooltip position=${this.tooltipPosition}>${this.tooltip}</lc-tooltip>` : null}
    `;
    const useButton = !this.href;

    const innerTabindex = this.tabindex != null ? "-1" : nothing;

    const accessibleName = this.ariaLabel || this.alt || this.label || nothing;

    if (useButton)
      return html`
        <button
          part="lc-link-anchor"
          name=${this.name || this.label || this.alt}
          aria-label=${accessibleName}
          aria-pressed=${this.ariaPressed || nothing}
          aria-current=${this.active ? "true" : nothing}
          aria-disabled=${this.disabled ? "true" : "false"}
          ?disabled=${this.disabled}
          type="button"
          tabindex=${innerTabindex}
        >
          ${content}
        </button>
      `;

    const resolvedHref = this._getHref();

    return html`
      <a
        part="lc-link-anchor"
        href=${this.disabled ? nothing : resolvedHref || "#"}
        target=${this.external ? "_blank" : nothing}
        rel=${this.rel || (this.external ? "noopener" : nothing)}
        related=${this.related}
        name=${this.name || this.label || this.alt}
        alt=${this.alt || this.label || this.name}
        aria-label=${accessibleName}
        aria-pressed=${this.ariaPressed || nothing}
        aria-current=${this.active ? "page" : nothing}
        aria-disabled=${this.disabled ? "true" : "false"}
        ?disabled=${this.disabled}
        tabindex=${innerTabindex}
      >
        ${content}
      </a>
    `;
  },
});
