import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";

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
 * `for` names a plain native control. An `lc-*` control already renders its
 * own control, so name it with the component's `label` prop or wrap it in a
 * `<label>` instead.
 *
 * @example
 * // A plain native field
 * ```html
 * <lc-label for="username">Username</lc-label>
 * <input id="username" />
 * ```
 *
 * @example
 * // Required label
 * ```html
 * <lc-label for="email" required>Email</lc-label>
 * <input id="email" type="email" required />
 * ```
 */
