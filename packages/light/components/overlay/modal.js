import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { withOverlay } from "@bootstrapp/light/components/mixins/overlay.js";
import { lcText } from "../utils/text.js";

/** @import { Prop } from "../types.ts" */

export default defineComponent({
  mixins: [withOverlay({ dismissible: false, restoreFocus: false })],
  tag: "lc-modal",
  props: {
    open: false,
    closeOnEscape: true,
    closeOnBackdropClick: true,
    size: T.string({ defaultValue: "md", enum: ["sm", "md", "lg", "xl"] }),
    variant: T.string({ defaultValue: "default", enum: ["default", "media", "sheet"] }),
    caption: "",
    dialog: /** @type {Prop<HTMLDialogElement | null>} */ (
      T.object({ reactive: false, defaultValue: null })
    ),
  },
  style: true,
  firstUpdated() {
    const dialog = this.querySelector("dialog");
    this.dialog = dialog;
    if (!dialog) return;
    dialog.addEventListener("close", () => {
      if (dialog.open || !this.open) return;
      this.open = false;
      this.$emit("modal-close", { returnValue: dialog.returnValue });
    });
    dialog.addEventListener("cancel", (e) => {
      if (!this.closeOnEscape)
        e.preventDefault();
       else
        this.$emit("modal-cancel");

    });
    dialog.addEventListener("click", (e) => {
      if (this.closeOnBackdropClick && e.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        const isInDialog =
          rect.top <= e.clientY &&
          e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX &&
          e.clientX <= rect.left + rect.width;

        if (!isInDialog) this.close();
      }
    });

    for (const link of this.querySelectorAll("[data-close]"))
      link.addEventListener("click", () => this.close());
  },
  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("open") && this.dialog)
      if (this.open && !this.dialog.open)
        this.showModal();
       else if (!this.open && this.dialog.open)
        this.dialog.close();

  },
  showModal() {
    if (this.dialog && !this.dialog.open) {
      this.dialog.showModal();
      this.open = true;
      this.$emit("modal-open");
    }
  },
  show() {
    if (this.dialog && !this.dialog.open) {
      this.dialog.show();
      this.open = true;
      this.$emit("modal-open");
    }
  },
  /** @param {string} [returnValue] */
  close(returnValue) {
    if (this.dialog?.open) {
      this.dialog.close(returnValue);
      this.open = false;
      this.$emit("modal-close", { returnValue: this.dialog.returnValue });
    }
  },
  render() {
    return html`
      <slot name="trigger" @click=${this.showModal.bind(this)}></slot>
      <dialog part="lc-modal-dialog">
        <div part="lc-modal-header" class="modal-header">
          <slot name="header"></slot>
          <button
            part="lc-modal-close-button"
            class="modal-close-button"
            @click=${() => this.close()}
            aria-label=${lcText("lc-modal", "close")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div part="lc-modal-body" class="modal-body">
          <slot></slot>
        </div>
        <slot part="lc-modal-footer" class="modal-footer" name="footer"></slot>
        ${this.caption ? html`<div part="lc-modal-caption">${this.caption}</div>` : ""}
      </dialog>
    `;
  },
});

/**
 * Modal Component
 *
 * @component
 * @category overlay
 * @tag lc-modal
 *
 * Modal dialog using native HTML dialog API with flexible trigger options
 *
 * @example
 * // Pattern 1: Modal with trigger button in slot
 * ```html
 * <lc-modal>
 *   <button slot="trigger">Open Modal</button>
 *   <h2 slot="header">Modal Title</h2>
 *   <p>Modal content goes here...</p>
 *   <div slot="footer">
 *     <lc-button data-close>Cancel</lc-button>
 *     <lc-button variant="primary">Confirm</lc-button>
 *   </div>
 * </lc-modal>
 * ```
 *
 * @example
 * // Pattern 2: Modal opened from external button
 * ```js
 * html`<button @click=${() => document.querySelector('#myModal').showModal()}>
 *   Open Modal
 * </button>
 *
 * <lc-modal id="myModal">
 *   <h2 slot="header">Delete Item</h2>
 *   <p>Are you sure you want to delete this item?</p>
 *   <div slot="footer">
 *     <lc-button @click=${(e) => e.target.closest('lc-modal').close()}>
 *       Cancel
 *     </lc-button>
 *     <lc-button variant="danger" @click=${this.handleDelete}>
 *       Delete
 *     </lc-button>
 *   </div>
 * </lc-modal>`
 * ```
 *
 * @example
 *  Pattern 3: Controlled modal with open property
 * ```js
 * html`<lc-modal
 *   ?open=${this.isModalOpen}
 *   @modal-close=${() => this.isModalOpen = false}
 * >
 *   <h2 slot="header">Settings</h2>
 *   <p>Modal content...</p>
 *   <div slot="footer">
 *     <lc-button @click=${() => this.isModalOpen = false}>Close</lc-button>
 *   </div>
 * </lc-modal>`
 * ```
 *
 * @example
 * // With options
 * ```js
 * html`<lc-modal
 *   .closeOnEscape=${false}
 *   .closeOnBackdropClick=${false}
 *   @modal-close=${this.handleClose}
 * >
 *   <h2 slot="header">Important Notice</h2>
 *   <p>This modal cannot be closed by clicking outside or pressing Escape.</p>
 *   <div slot="footer">
 *     <lc-button @click=${(e) => e.target.closest('lc-modal').close('confirmed')}>
 *       I Understand
 *     </lc-button>
 *   </div>
 * </lc-modal>`
 * ```
 *
 * @example
 * // Media: one picture or clip filling the screen, with a way out
 * ```js
 * html`<lc-modal variant="media" ?open=${Boolean(this.viewing)} caption=${this.viewing?.dayKey}
 *   @modal-close=${() => (this.viewing = null)}>
 *   <lc-button slot="header" iconOnly icon="trash-2" ghost @click=${() => this.remove()}></lc-button>
 *   <img src=${this.url} alt="">
 * </lc-modal>`
 * ```
 *
 * @example
 * // Sheet: on a phone it rises from the bottom edge, sized to its content, and
 * // as a dialog in the top layer it sits over an open `lc-bottom-sheet`
 * ```js
 * html`<lc-modal variant="sheet" size="sm" ?open=${this.asking} @modal-close=${() => (this.asking = false)}>
 *   <h2 slot="header">Sign in to post</h2>
 *   <p>The ways in.</p>
 * </lc-modal>`
 * ```
 */
