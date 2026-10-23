import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { uniqueId } from "../utils/id.js";
import { nextIndex } from "../utils/roving.js";

export default defineComponent({
  tag: "lc-tabs",
  props: {
    _tabsBaseId: T.string({ reactive: false, defaultValue: "" }),
    _raf: T.number({ reactive: false, defaultValue: 0 }),
    activeTab: 0,
    variant: T.string({
      defaultValue: "default",
      enum: ["default", "pills", "underline"],
    }),
    vertical: T.boolean(),
    responsive: T.boolean(),
    fullWidth: false,
  },
  style: true,

  connected() {
    this.$own(() => {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    });
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("activeTab")) this.updateActivePanels();
  },

  firstUpdated() {
    const panelSlot = /** @type {HTMLSlotElement} */ (this.querySelector("slot[name=panel]"));
    const tabSlot = /** @type {HTMLSlotElement} */ (this.querySelector("slot[name=tab]"));

    panelSlot.addEventListener("slotchange", () => {
      this.updateActivePanels();
    });
    tabSlot.addEventListener("slotchange", () => {
      this.updateActivePanels();
      this.equalizeTabWidths();
    });

    this.updateActivePanels();
    this.equalizeTabWidths();

    this.addEventListener("keydown", (e) => {
      if (!(e instanceof KeyboardEvent)) return;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;

      const tabSlot = /** @type {HTMLSlotElement} */ (this.querySelector("slot[name=tab]"));
      const tabs = /** @type {HTMLElement[]} */ ([...tabSlot.children]);
      if (!tabs.length) return;

      const target = /** @type {Element} */ (e.composedPath()[0]);
      const isInputElement = target.matches?.("input, textarea, select, [contenteditable]");
      const path = e.composedPath();
      const isFocusOnTab = tabs.some(tab => path.includes(tab));
      if (isInputElement || !isFocusOnTab) return;

      e.preventDefault();
      const newIndex = nextIndex(e.key, this.activeTab, tabs.length, {
        wrap: true,
        homeEnd: true,
        orientation: this.vertical ? "vertical" : "horizontal",
      });
      if (newIndex === null) return;

      this.activeTab = newIndex;
      this.updateActivePanels();
      tabs[newIndex].focus();
      this.$emit("tab-change", newIndex);
    });
  },

  equalizeTabWidths() {
    const tabSlot = /** @type {HTMLSlotElement} */ (this.querySelector("slot[name=tab]"));
    const tabs = /** @type {HTMLElement[]} */ ([...tabSlot.children]);
    if (!tabs.length) return;

    tabs.forEach((t) => { t.style.minWidth = ""; });

    if (this.fullWidth) return;

    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      let max = 0;
      tabs.forEach((t) => {
        const w = t.getBoundingClientRect().width;
        if (w > max) max = w;
      });
      if (max <= 0) return;
      tabs.forEach((t) => { t.style.minWidth = `${max}px`; });
    });
  },

  updateActivePanels() {
    const panelSlot = /** @type {HTMLSlotElement} */ (this.querySelector("slot[name=panel]"));
    const tabSlot = /** @type {HTMLSlotElement} */ (this.querySelector("slot[name=tab]"));

    if (!panelSlot) return;

    const panels = /** @type {Element[]} */ ([...panelSlot.children]);
    const tabs = /** @type {HTMLElement[]} */ ([...tabSlot.children]);

    if (!this._tabsBaseId)
      this._tabsBaseId = this.id || uniqueId("lc-tabs-");

    const baseId = this._tabsBaseId;

    tabs.forEach((tab, index) => {
      const tabId = `${baseId}-tab-${index}`;
      const panelId = `${baseId}-panel-${index}`;

      tab.setAttribute("role", "tab");
      tab.setAttribute("id", tabId);
      tab.setAttribute("aria-selected", index === this.activeTab ? "true" : "false");
      tab.setAttribute("tabindex", index === this.activeTab ? "0" : "-1");

      if (panels[index])
        tab.setAttribute("aria-controls", panelId);

      if (index === this.activeTab)
        tab.setAttribute("active", "");
       else
        tab.removeAttribute("active");

    });

    panels.forEach((panel, index) => {
      const panelId = `${baseId}-panel-${index}`;
      const tabId = `${baseId}-tab-${index}`;

      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("id", panelId);
      if (tabs[index])
        panel.setAttribute("aria-labelledby", tabId);

      if (panels.length > 1)
        if (index === this.activeTab)
          panel.removeAttribute("hide");
         else
          panel.setAttribute("hide", "");

    });
  },

  /** @param {MouseEvent} e */
  selectTab(e) {
    const tabSlot = /** @type {HTMLSlotElement} */ (this.querySelector("slot[name=tab]"));
    const tabs = /** @type {HTMLElement[]} */ ([...tabSlot.children]);
    const path = e.composedPath();
    const index = tabs.findIndex((tab) => path.includes(tab));
    if (index === -1 || index === this.activeTab) return;
    this.activeTab = index;
    this.updateActivePanels();
    this.$emit("tab-change", index);
  },

  render() {
    return html`
        <div
          part="lc-tabs-tab-list"
          role="tablist"
          aria-orientation=${this.vertical ? "vertical" : "horizontal"}
        >
          <slot name="tab" part="lc-tabs-tab" @click=${this.selectTab.bind(this)}></slot>
        </div>
        <slot name="panel" part="lc-tabs-panel"></slot>

    `;
  },
});

/**
 * Tabs Component
 *
 * @component
 * @category navigation
 * @tag lc-tabs
 *
 * Accessible tabs with keyboard navigation and flexible content
 *
 * @example
 * // Pattern 1: Static tabs with multiple panels (each panel rendered separately)
 * ```html
 * <lc-tabs activeTab=2>
 *   <button slot="tab">Profile</button>
 *   <button slot="tab">Settings</button>
 *   <button slot="tab">Account</button>
 *
 *   <div slot="panel">Profile content...</div>
 *   <div slot="panel">Settings content...</div>
 *   <div slot="panel">Account content...</div>
 * </lc-tabs>
 * ```
 *
 * @example
 * // Pattern 2: Dynamic tabs with single panel (content switches based on active tab)
 * ```js
 * html`<lc-tabs>
 *   ${sections.map(section => html`
 *     <button slot="tab">
 *       <lc-icon name=${section.icon}></lc-icon>
 *       ${section.label}
 *     </button>
 *   `)}
 *   <div slot="panel">
 *     ${sections[this.activeTab].render()}
 *   </div>
 * </lc-tabs>`
 * ```
 * @example
 * // With variants
 *
 * ```html
 * <lc-tabs variant="pills">
 *   <button slot="tab">Tab 1</button>
 *   <button slot="tab">Tab 2</button>
 *   <div slot="panel">Panel 1</div>
 *   <div slot="panel">Panel 2</div>
 * </lc-tabs>
 * ```
 *
 * @example
 * // Vertical orientation
 * ```html
 * <lc-tabs vertical variant="underline">
 *   <button slot="tab">Navigation</button>
 *   <button slot="tab">Content</button>
 *   <div slot="panel">Nav content</div>
 *   <div slot="panel">Main content</div>
 * </lc-tabs>
 * ```
 * @example
 * // Controlled with property binding
 * ```js
 * html`<lc-tabs .activeTab=${this.currentTab} @tab-change=${this.handleTabChange}>
 *   <button slot="tab">First</button>
 *   <button slot="tab">Second</button>
 *   <div slot="panel">First panel</div>
 *   <div slot="panel">Second panel</div>
 * </lc-tabs>`
 */
