import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-sidebar-section",
  style: true,
  props: {
    label: "",
    count: T.number({ defaultValue: null }),
    collapsed: false,
    fill: false,
    static: T.boolean(),
    icon: "",
    size: T.string({ defaultValue: "sm", enum: ["sm", "md"] }),
  },

  events: {
    "toggle": T.object({ collapsed: T.boolean() }),
  },

  render() {
    const iconSize = this.size === "md" ? "16" : "11";
    const title = html`
      ${this.icon ? html`<lc-icon name=${this.icon} size=${iconSize}></lc-icon>` : ""}
      <span part="lc-sidebar-section-label">${this.label}</span>
      ${this.count != null ? html`<lc-badge size="xs">${this.count}</lc-badge>` : ""}
    `;
    return html`
      <div part="lc-sidebar-section-header">
        ${
          this.static
            ? html`<div part="lc-sidebar-section-heading">${title}</div>`
            : html`<button part="lc-sidebar-section-toggle"
                @click=${() => this.$emit("toggle", { collapsed: !this.collapsed })}>
                <lc-icon name=${this.collapsed ? "chevron-right" : "chevron-down"} size=${this.size === "md" ? "14" : "10"} part="lc-sidebar-section-chevron"></lc-icon>
                ${title}
              </button>`
        }
        <div part="lc-sidebar-section-actions" @click=${(e) => e.stopPropagation()}>
          <slot name="actions"></slot>
        </div>
      </div>
      <div part="lc-sidebar-section-body" ?hidden=${this.collapsed && !this.static}>
        <slot></slot>
      </div>
    `;
  },
});
