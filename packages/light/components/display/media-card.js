import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-media-card",
  style: true,
  props: {
    src: T.string(),
    alt: T.string(),
    aspect: "4/5",
    scrim: true,
    _hasBody: T.boolean({ attribute: false }),
  },
  /** @param {Event} e */
  _onBodyChange(e) {
    const slot = /** @type {HTMLSlotElement} */ (e.target);
    this._hasBody = [...slot.childNodes].some((node) =>
      node.nodeType === Node.ELEMENT_NODE || (node.textContent ?? "").trim() !== "");
  },
  render() {
    return html`
      <div part="lc-media-card-media" class="media" style="aspect-ratio:${this.aspect}">
        ${this.src ? html`<img part="lc-media-card-image" src=${this.src} alt=${this.alt || ""} loading="lazy" />` : nothing}
        ${this.scrim ? html`<div part="lc-media-card-scrim" class="scrim"></div>` : nothing}
        <div part="lc-media-card-top" class="top"><slot name="top"></slot></div>
        <div part="lc-media-card-bottom" class="bottom"><slot name="bottom"></slot></div>
      </div>
      <div part="lc-media-card-body" class="body" ?hidden=${!this._hasBody}><slot @slotchange=${(e) => this._onBodyChange(e)}></slot></div>
    `;
  },
});

/**
 * Media Card Component
 *
 * @component
 * @category display
 * @tag lc-media-card
 *
 * An image at a fixed aspect, rounded and lifted by the theme's box role, with
 * a scrim darkening its lower half so a title set over it reads. A badge goes
 * in the top-left corner, the title over the scrim, and any meta text under
 * the image.
 *
 * @slot top - Pinned to the image's top-left corner (a badge)
 * @slot bottom - Over the scrim at the image's foot (a title)
 * @slot - Under the image (meta text); the space collapses when empty
 *
 * @part media - The image box
 * @part image - The image
 * @part scrim - The gradient over the image
 * @part top - The top-left wrapper
 * @part bottom - The wrapper over the scrim
 * @part body - The wrapper under the image
 *
 * @example
 * ```html
 * <lc-media-card src=${cover} alt="Sunset run">
 *   <lc-badge slot="top" soft dot variant="success">Published</lc-badge>
 *   <strong slot="bottom">Sunset run</strong>
 *   <span>12.4K reach</span>
 * </lc-media-card>
 * ```
 */
