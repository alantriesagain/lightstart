import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

export default defineComponent({
  tag: "lc-avatar-group",
  style: true,
  props: {
    max: 4,
    size: T.string({ defaultValue: "sm", enum: ["xs", "sm", "md", "lg", "xl"] }),
    _overflow: T.number({ attribute: false, defaultValue: 0 }),
  },
  _sync() {
    const avatars = [...(this.querySelector(":scope > [part~=lc-avatar-group-group] > slot")?.children ?? [])].filter((child) => child.localName === "lc-avatar");
    const max = Math.max(0, this.max);
    avatars.forEach((avatar, index) => {
      avatar.setAttribute("size", this.size);
      avatar.toggleAttribute("hidden", index >= max);
    });
    this._overflow = Math.max(0, avatars.length - max);
  },
  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("max") || changedProps.has("size")) this._sync();
  },
  render() {
    return html`
      <div part="lc-avatar-group-group" class="group">
        <slot @slotchange=${() => this._sync()}></slot>
        ${
          this._overflow
            ? html`<span part="lc-avatar-group-more" class="more" role="img" aria-label=${lcText("lc-avatar-group", "more", { count: this._overflow })}>+${this._overflow}</span>`
            : ""
        }
      </div>
    `;
  },
});

/**
 * Avatar Group Component
 *
 * @component
 * @category display
 * @tag lc-avatar-group
 *
 * A row of overlapping `lc-avatar`s, each ringed in the page colour. Past `max`
 * the rest are hidden and a "+n" avatar closes the row.
 *
 * @slot - The `lc-avatar` children
 *
 * @part group - The row
 * @part more - The "+n" tail avatar
 *
 * @example
 * ```html
 * <lc-avatar-group max="3">
 *   <lc-avatar name="Ana Lima"></lc-avatar>
 *   <lc-avatar name="Bruno Reis"></lc-avatar>
 *   <lc-avatar name="Carla Dias"></lc-avatar>
 *   <lc-avatar name="Davi Souza"></lc-avatar>
 * </lc-avatar-group>
 * ```
 */
