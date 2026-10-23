import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";
import { withOverlay } from "@bootstrapp/light/components/mixins/overlay.js";

/** @import { AlertVariant, Prop } from "../types.ts" */

export default defineComponent({
  mixins: [withOverlay({ dismissible: false, restoreFocus: false })],
  tag: "lc-alert-dialog",
  icons: ["circle-check", "circle-x", "triangle-alert", "info"],
  props: {
    open: false,
    title: "",
    message: "",
    variant: /** @type {Prop<AlertVariant>} */ (
      T.string({
        defaultValue: "default",
        enum: ["default", "success", "warning", "error", "info"],
      })
    ),
    confirmText: "",
    cancelText: "",
    showCancel: false,
    closeOnBackdropClick: false,
  },

  events: {
    open: T.any(),
    confirm: T.any(),
    cancel: T.any(),
  },
  style: true,

  /** @type {HTMLDialogElement | null} */
  _dialog: null,

  connected() {
    this._dialog = this.querySelector("dialog");
    if (this.open)
      this.show();

  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("open"))
      if (this.open)
        this.show();
       else
        this.close();

  },

  show() {
    if (!this._dialog)
      this._dialog = this.querySelector("dialog");

    this._dialog?.showModal();
    this.open = true;
    this.$emit("open");
  },

  close(confirmed = false) {
    this._dialog?.close(confirmed ? "confirm" : "cancel");
    this.open = false;
    this.$emit("close", { confirmed });
  },

  confirm() {
    this.close(true);
    this.$emit("confirm");
  },

  cancel() {
    this.close(false);
    this.$emit("cancel");
  },

  /** @param {Event} e */
  handleBackdropClick(e) {
    if (this.closeOnBackdropClick && e.target === this._dialog)
      this.cancel();

  },

  /** @param {AlertVariant} variant */
  _getIcon(variant) {
    const icons = {
      success: "circle-check",
      error: "circle-x",
      warning: "triangle-alert",
      info: "info",
      default: null,
    };
    return icons[variant];
  },

  render() {
    const icon = this._getIcon(this.variant);

    return html`
      <dialog
        class="alert-dialog"
        @click=${this.handleBackdropClick}
        @cancel=${(e) => {
          e.preventDefault();
          this.cancel();
        }}
      >
        <div class="alert-dialog-content ${this.variant}">
          ${
            icon
              ? html`
                <div class="alert-dialog-icon">
                  <lc-icon name=${icon}></lc-icon>
                </div>
              `
              : ""
          }

          <div class="alert-dialog-body">
            ${this.title ? html`<h3 class="alert-dialog-title">${this.title}</h3>` : ""}

            <div class="alert-dialog-message">
              ${this.message ? html`<p>${this.message}</p>` : ""}
              <slot></slot>
            </div>
          </div>

          <div class="alert-dialog-actions">
            ${
              this.showCancel
                ? html`
                  <button class="alert-dialog-button cancel" @click=${this.cancel}>
                    ${this.cancelText || lcText("lc-alert-dialog", "cancel")}
                  </button>
                `
                : ""
            }
            <button class="alert-dialog-button confirm" @click=${this.confirm}>
              ${this.confirmText || lcText("lc-alert-dialog", "confirm")}
            </button>
          </div>
        </div>
      </dialog>
    `;
  },
});

/**
 * Alert Dialog Component
 *
 * @component
 * @category overlay
 * @tag lc-alert-dialog
 *
 * A modal dialog for important messages, confirmations, and alerts.
 *
 * @example
 * // Basic alert
 * ```html
 * <lc-alert-dialog
 *   title="Welcome"
 *   message="Thank you for signing up!"
 * ></lc-alert-dialog>
 *
 * <lc-button onclick="this.previousElementSibling.show()">
 *   Show Alert
 * </lc-button>
 * ```
 *
 * @example
 * // Confirmation dialog
 * ```html
 * <lc-alert-dialog
 *   title="Delete Item"
 *   message="Are you sure you want to delete this item? This action cannot be undone."
 *   variant="error"
 *   show-cancel
 *   confirm-text="Delete"
 *   cancel-text="Cancel"
 * ></lc-alert-dialog>
 *
 * <lc-button onclick="this.previousElementSibling.show()">
 *   Delete
 * </lc-button>
 * ```
 *
 * @example
 * // Success alert
 * ```html
 * <lc-alert-dialog
 *   title="Success!"
 *   message="Your changes have been saved successfully."
 *   variant="success"
 *   confirm-text="Great!"
 * ></lc-alert-dialog>
 * ```
 *
 * @example
 * // Warning alert
 * ```html
 * <lc-alert-dialog
 *   title="Warning"
 *   message="Your session is about to expire. Would you like to continue?"
 *   variant="warning"
 *   show-cancel
 *   confirm-text="Continue"
 *   cancel-text="Logout"
 * ></lc-alert-dialog>
 * ```
 *
 * @example
 * // Info alert
 * ```html
 * <lc-alert-dialog
 *   title="New Features"
 *   message="Check out our latest updates and improvements!"
 *   variant="info"
 *   confirm-text="Learn More"
 * ></lc-alert-dialog>
 * ```
 *
 * @example
 * // With custom content
 * ```html
 * <lc-alert-dialog title="Custom Content" variant="info">
 *   <p>This dialog can contain any HTML content:</p>
 *   <ul>
 *     <li>Bullet points</li>
 *     <li>Links</li>
 *     <li>Images</li>
 *   </ul>
 *   <img src="/image.jpg" alt="Example" style="max-width: 100%;">
 * </lc-alert-dialog>
 * ```
 *
 * @example
 * // With event handling
 * ```html
 * <lc-alert-dialog
 *   id="confirmDialog"
 *   title="Confirm Action"
 *   message="Do you want to proceed?"
 *   show-cancel
 * ></lc-alert-dialog>
 *
 * <script>
 *   const dialog = document.querySelector('#confirmDialog');
 *   dialog.addEventListener('confirm', () => {
 *     console.log('User confirmed');
 *     // Perform action
 *   });
 *   dialog.addEventListener('cancel', () => {
 *     console.log('User cancelled');
 *   });
 * </script>
 * ```
 *
 * @example
 * // Programmatic control
 * ```js
 * const dialog = document.querySelector('lc-alert-dialog');
 *
 * // Show the dialog
 * dialog.show();
 *
 * // Close the dialog
 * dialog.close();
 *
 * // Confirm (triggers confirm event)
 * dialog.confirm();
 *
 * // Cancel (triggers cancel event)
 * dialog.cancel();
 * ```
 *
 * @example
 * // Close on backdrop click
 * ```html
 * <lc-alert-dialog
 *   title="Click Outside to Close"
 *   message="This dialog will close when you click the backdrop."
 *   close-on-backdrop-click
 * ></lc-alert-dialog>
 * ```
 */
