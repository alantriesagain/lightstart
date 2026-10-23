/**
 * Empty State Component
 *
 * @component
 * @category feedback
 * @tag lc-empty-state
 *
 * Placeholder shown when a list or section has no content yet: an optional icon,
 * a title, a description, and a default slot for a call-to-action (drop a
 * `<lc-button>` in).
 *
 * @slot - Optional call-to-action (e.g. a button)
 *
 * @example
 * ```html
 * <lc-empty-state icon="image" title="No media yet" description="Start with a template above.">
 *   <lc-button primary>New media</lc-button>
 * </lc-empty-state>
 * ```
 *
 * @part root - The outer container
 * @part icon - The icon wrapper
 * @part title - The title text
 * @part description - The description text
 * @part actions - The call-to-action slot wrapper
 */
import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

const ICON_SIZE = { sm: 22, md: 30, lg: 40 };

export default defineComponent({
  tag: "lc-empty-state",
  style: true,

  props: {
    icon: "",
    title: "",
    description: "",
    size: T.string({ defaultValue: "md", enum: ["sm", "md", "lg"] }),
  },

  render() {
    return html`
      <div part="lc-empty-state-root" class="empty-state empty-state-${this.size}">
        ${this.icon
          ? html`<div part="lc-empty-state-icon" class="empty-state-icon"><lc-icon name=${this.icon} size=${ICON_SIZE[/** @type {keyof typeof ICON_SIZE} */ (this.size)] || ICON_SIZE.md}></lc-icon></div>`
          : nothing}
        ${this.title ? html`<div part="lc-empty-state-title" class="empty-state-title">${this.title}</div>` : nothing}
        ${this.description ? html`<div part="lc-empty-state-description" class="empty-state-description">${this.description}</div>` : nothing}
        <div part="lc-empty-state-actions" class="empty-state-actions"><slot></slot></div>
      </div>
    `;
  },
});
