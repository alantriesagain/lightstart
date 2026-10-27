import { html } from "/app/light/html/index.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";

export default defineComponent({
  tag: "lc-label",
  props: {
    for: T.string(),
    text: T.string(),
    required: false,
    inline: false,
  },
  style: true,

  render() {
    return html`
      <label class="label" for=${this.for || ""}>${this.text}${this.required ? html`<span class="label-required">*</span>` : ""}</label>
    `;
  },
});

/**
 * Label Component
 *
 * @component
 * @category form
 * @tag lc-label
 *
 * A form label with consistent styling and required indicator support.
 *
 * @example
 * // Basic label
 * ```html
 * <lc-label for="username">Username</lc-label>
 * <lc-input id="username"></lc-input>
 * ```
 *
 * @example
 * // Required label
 * ```html
 * <lc-label for="email" required>Email</lc-label>
 * <lc-input id="email" required></lc-input>
 * ```
 */
