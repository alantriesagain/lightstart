import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-accordion",
  style: true,
  props: {
    _initialized: T.boolean({ reactive: false, defaultValue: false }),
    variant: T.string({
      defaultValue: "default",
      enum: ["default", "bordered", "filled", "flush", "separated"],
    }),
    single: false,
    rounded: true,
    openItems: [],
  },

  connected() {
    this._initialized = false;
  },

  updated() {
    if (!this._initialized) {
      this._initItems();
      this._initialized = true;
    }
    this._syncPanels();
  },

  _items() {
    const slot = this.querySelector(":scope > [part~=lc-accordion-container] > slot");
    return Array.from(slot ? slot.children : this.children);
  },

  _initItems() {
    const children = this._items();
    /** @type {number[]} */
    const open = [];
    children.forEach((child, index) => {
      if (index % 2 === 0 && child.hasAttribute("open"))
        open.push(Math.floor(index / 2));

    });
    if (open.length > 0)
      this.openItems = open;

  },

  _syncPanels() {
    const children = this._items();
    children.forEach((child, index) => {
      const panelIndex = Math.floor(index / 2);
      const isOpen = this.openItems.includes(panelIndex);

      if (index % 2 === 0)
        child.toggleAttribute("active", isOpen);
       else
        child.toggleAttribute("hide", !isOpen);

    });
  },

  /** @param {MouseEvent} e */
  _handleClick(e) {
    const children = this._items();
    const header = children.find(
      (child, i) => i % 2 === 0 && (child === e.target || child.contains(/** @type {Node} */ (e.target))),
    );
    if (!header) return;
    if (header.hasAttribute("prevent-collapse")) return;

    const clickedIndex = children.indexOf(header);
    const panelIndex = Math.floor(clickedIndex / 2);

    if (this.single)
      this.openItems = this.openItems.includes(panelIndex) ? [] : [panelIndex];
     else
      this.openItems = this.openItems.includes(panelIndex)
        ? this.openItems.filter((i) => i !== panelIndex)
        : [...this.openItems, panelIndex];

    this.$emit("accordion-toggle", {
      index: panelIndex,
      open: this.openItems.includes(panelIndex),
    });
  },

  render() {
    return html`
      <div part="lc-accordion-container" class="accordion-container">
        <slot @click=${this._handleClick.bind(this)}></slot>
      </div>
    `;
  },
});

/**
 * Accordion Component
 *
 * @component
 * @category navigation
 * @tag lc-accordion
 *
 * Collapsible container with alternating header/content pairs.
 * Even-indexed children are headers, odd-indexed are content panels.
 *
 * @example Basic Accordion
 * ```html
 * <lc-accordion>
 *   <button>Section 1</button>
 *   <div>Content for section 1</div>
 *   <button>Section 2</button>
 *   <div>Content for section 2</div>
 * </lc-accordion>
 * ```
 *
 * @example Bordered with Initial Open
 * ```html
 * <lc-accordion variant="bordered">
 *   <button open>Open by default</button>
 *   <div>This panel starts open</div>
 *   <button>Closed</button>
 *   <div>This panel starts closed</div>
 * </lc-accordion>
 * ```
 *
 * @example Single Mode
 * ```html
 * <lc-accordion single variant="filled">
 *   <button>Profile</button>
 *   <div>Profile settings content</div>
 *   <button>Settings</button>
 *   <div>General settings content</div>
 * </lc-accordion>
 * ```
 */
