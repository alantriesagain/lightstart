import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";
import { toasts } from "./toasts.js";

/** @import { Prop, ToastItem } from "../types.ts" */

export default defineComponent({
  tag: "lc-toast",
  icons: ["circle-check", "circle-x", "triangle-alert", "info", "bell"],
  props: {
    position: T.string({
      defaultValue: "top-right",
      enum: [
        "top-left",
        "top-center",
        "top-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
    }),
    toasts: /** @type {Prop<ToastItem[]>} */ (T.array({ defaultValue: [] })),
  },
  style: true,
  connected() {
    this.$own(toasts.items.subscribe((/** @type {ToastItem[]} */ items) => { this.toasts = items; }));
  },
  /** @param {string} variant */
  _getIcon(variant) {
    const icons = {
      success: "circle-check",
      error: "circle-x",
      warning: "triangle-alert",
      info: "info",
      default: "bell",
    };
    return icons[/** @type {keyof typeof icons} */ (variant)] || icons.default;
  },

  /** @param {ToastItem} toast */
  _body(toast) {
    return html`
      <div part="lc-toast-icon" class="toast-icon">
        <lc-icon name=${toast.icon || this._getIcon(toast.variant)}></lc-icon>
      </div>
      <div part="lc-toast-content" class="toast-content">
        ${toast.title ? html`<div part="lc-toast-title" class="toast-title">${toast.title}</div>` : ""}
        ${toast.message ? html`<div part="lc-toast-message" class="toast-message">${toast.message}</div>` : ""}
      </div>`;
  },

  render() {
    if (!this.toasts.length) return "";

    return html`
      <div part="lc-toast-container" class="toast-container ${this.position}">
        ${this.toasts.map(
          (toast) => html`
            <div
              part="lc-toast-toast"
              class="toast toast-${toast.variant}"
              role="alert"
              aria-live="polite"
              aria-atomic="true"
            >
              ${toast.onTap
                ? html`<button type="button" part="lc-toast-body lc-toast-tap" class="toast-body" @click=${() => toasts.tap(toast.id)}>${this._body(toast)}</button>`
                : html`<div part="lc-toast-body" class="toast-body">${this._body(toast)}</div>`}
              ${
                toast.closable
                  ? html`
                    <button
                      part="lc-toast-close"
                      class="toast-close"
                      @click=${() => toasts.hide(toast.id)}
                      aria-label=${lcText("lc-toast", "close")}
                    >
                      <lc-icon name="x"></lc-icon>
                    </button>
                  `
                  : ""
              }
            </div>
          `,
        )}
      </div>
    `;
  },
});

/**
 * Toast Component
 *
 * @component
 * @category feedback
 * @tag lc-toast
 *
 * Toast notifications for displaying temporary messages to users.
 *
 * @example
 * // Basic toast (programmatic)
 * ```js
 * toasts.show({ message: 'Hello World!' });
 * ```
 *
 * @example
 * // Success toast
 * ```js
 * toasts.show({
 *   title: 'Success!',
 *   message: 'Your changes have been saved.',
 *   variant: 'success'
 * });
 * ```
 *
 * @example
 * // Error toast
 * ```js
 * toasts.show({
 *   title: 'Error',
 *   message: 'Failed to save changes. Please try again.',
 *   variant: 'error',
 *   duration: 5000
 * });
 * ```
 *
 * @example
 * // Warning toast
 * ```js
 * toasts.show({
 *   title: 'Warning',
 *   message: 'Your session will expire in 5 minutes.',
 *   variant: 'warning'
 * });
 * ```
 *
 * @example
 * // Info toast
 * ```js
 * toasts.show({
 *   title: 'Did you know?',
 *   message: 'You can press Ctrl+S to save.',
 *   variant: 'info',
 *   duration: 6000
 * });
 * ```
 *
 * @example
 * // Permanent toast (manual close only)
 * ```js
 * toasts.show({
 *   message: 'This stays until you close it.',
 *   duration: 0
 * });
 * ```
 *
 * @example
 * // Different positions
 * ```html
 * <lc-toast position="top-left"></lc-toast>
 * <lc-toast position="top-center"></lc-toast>
 * <lc-toast position="top-right"></lc-toast>
 * <lc-toast position="bottom-left"></lc-toast>
 * <lc-toast position="bottom-center"></lc-toast>
 * <lc-toast position="bottom-right"></lc-toast>
 * ```
 *
 * @example
 * // Non-closable toast
 * ```js
 * toasts.show({
 *   message: 'Processing...',
 *   closable: false,
 *   duration: 2000
 * });
 * ```
 *
 * @example
 * // Multiple toasts
 * ```js
 * toasts.show({ message: 'First toast', variant: 'info' });
 * toasts.show({ message: 'Second toast', variant: 'success' });
 * toasts.show({ message: 'Third toast', variant: 'warning' });
 * ```
 *
 * @example
 * // Raising one from anywhere on the page
 * ```js
 * import { toasts } from "@bootstrapp/light/components/feedback/toasts.js";
 *
 * toasts.success("Saved");
 * toasts.show({ title: "Error", message: "Something went wrong!", variant: "error" });
 * toasts.hideAll();
 * ```
 */
