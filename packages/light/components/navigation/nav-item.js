import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { isActivePath } from "../utils/active-path.js";
import { navigation } from "@bootstrapp/light/navigation";

export default defineComponent({
  tag: "lc-nav-item",
  props: {
    icon: "",
    solid: false,
    bold: false,
    label: "",
    badge: "",
    dot: false,
    count: "",
    badgeVariant: T.string({ defaultValue: "default", enum: ["default", "primary", "muted"] }),
    active: false,
    prominent: false,
    href: "",
    activeMatch: "",
    exact: false,
    disabled: false,
    activeBg: T.boolean(),
    iconOnly: false,
    stacked: false,
    tooltip: false,
    tooltipPosition: "right",
    tooltipDelay: 200,
    tooltipVariant: T.string({
      defaultValue: "default",
      enum: [
        "default",
        "primary",
        "secondary",
        "success",
        "warning",
        "danger",
        "info",
      ],
    }),
    tooltipSize: T.string({
      defaultValue: "md",
      enum: ["sm", "md", "lg"],
    }),
    indicatorPosition: T.string({
      defaultValue: "none",
      enum: ["none", "left", "right", "top", "bottom"],
    }),
    size: T.string({
      defaultValue: "md",
      enum: ["sm", "md", "lg"],
    }),
  },
  style: true,
  _follow() {
    if (!this.activeMatch && !this.exact) return;
    this.active = isActivePath(navigation.path(), this.activeMatch || this.href, this.exact);
  },
  connected() {
    this._follow();
    if (!this.activeMatch && !this.exact) return;
    this.$own(navigation.subscribe(() => this._follow()));
  },
  /** @param {MouseEvent} e */
  _handleClick(e) {
    if (this.disabled) return void e.preventDefault();

    navigation.click(e);

    this.$emit("nav-item-click", {
      href: this.href,
      active: this.active,
      disabled: this.disabled,
    });
  },

  render() {
    const useTooltip = this.tooltip && this.iconOnly && !this.stacked && this.label;
    const tooltipEl = useTooltip
      ? html`<lc-tooltip
          position=${this.tooltipPosition}
          delay=${this.tooltipDelay}
          variant=${this.tooltipVariant}
          size=${this.tooltipSize}
        >${this.label}</lc-tooltip>`
      : null;

    const icon = this.icon
      ? html`
        <span part="lc-nav-item-icon" class="nav-item-icon">
          <lc-icon name=${this.icon} size=${this.size} ?solid=${this.solid} ?bold=${this.bold}></lc-icon>${this.dot ? html`<span part="lc-nav-item-dot" class="nav-item-dot"></span>` : null}${this.count ? html`<span part="lc-nav-item-count" class="nav-item-count">${this.count}</span>` : null}
        </span>
      `
      : null;

    const content = this.iconOnly && !this.stacked
      ? html`
          ${tooltipEl}
          ${icon}
        `
      : html`
          <span part="lc-nav-item-label" class="nav-item-label label">
          ${icon}
            <span part="lc-nav-item-text" class="nav-item-text">${this.label}</span>
          </span>
          ${
            this.badge
              ? html`
                <span part="lc-nav-item-badge" class="nav-item-badge badge">${this.badge}</span>
              `
              : null
          }
        `;

    const title = !useTooltip && this.iconOnly && !this.stacked ? this.label : "";

    if (this.href && !this.disabled)
      return html`
        <a
          part="lc-nav-item-container"
          class="nav-item"
          href=${navigation.href(this.href)}
          aria-current=${this.active ? "page" : nothing}
          title=${title}
          @click=${this._handleClick.bind(this)}
        >
          ${content}
        </a>
      `;

    return html`
      <button
        part="lc-nav-item-container"
        class="nav-item"
        title=${title}
        ?disabled=${this.disabled}
        @click=${this._handleClick.bind(this)}
      >
        ${content}
      </button>
    `;
  },
});

/**
 * @component lc-nav-item
 * @description A navigation item component with icon, label, badge, and active state support
 *
 * @property {string} icon - Icon name (uses lc-icon)
 * @property {boolean} bold - Draws the icon's strokes heavier
 * @property {string} label - Label text for the navigation item
 * @property {string} badge - Optional badge text/number to display
 * @property {boolean} dot - A dot on the icon's corner: something unread, nothing to count
 * @property {string} badgeVariant - Badge look: default, primary (filled, round) or muted (no fill)
 * @property {boolean} active - Whether the item is currently active/selected
 * @property {string} href - Optional link URL (renders as anchor)
 * @property {boolean} disabled - Whether the item is disabled
 * @property {boolean} stacked - Icon above the label, centred, for a labeled rail or a bottom nav
 * @property {string} size - Size variant (sm, md, lg)
 *
 * @event nav-item-click - Emitted when the item is clicked {href?, active, disabled}
 *
 *
 * @part container - The main container element (button or anchor)
 * @part icon - The icon wrapper
 * @part label - The label wrapper
 * @part badge - The badge wrapper
 * @part dot - The dot on the icon's corner
 *
 * @example
 * <lc-nav-item icon="house" label="Home" active></lc-nav-item>
 * <lc-nav-item icon="settings" label="Settings" badge="3"></lc-nav-item>
 * <lc-nav-item href="/docs" label="Documentation"></lc-nav-item>
 */
