import { html, nothing } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import { uniqueId } from "../utils/id.js";
import { nextIndex } from "../utils/roving.js";
import { lcText } from "../utils/text.js";
/** @import { Prop, TabItem } from "../types.ts" */

const TAG = "lc-tabs";

export default defineComponent({
  tag: "lc-tabs",
  props: {
    _tabsBaseId: T.string({ reactive: false, defaultValue: "" }),
    _raf: T.number({ reactive: false, defaultValue: 0 }),
    _suppressClick: T.boolean({ attribute: false, defaultValue: false, reactive: false }),
    activeTab: 0,
    tabs: /** @type {Prop<TabItem[]>} */ (T.array({
      attribute: false,
      defaultValue: [],
      itemType: {
        id: T.string(),
        label: T.string(),
        icon: T.string(),
        badge: T.string(),
        closable: T.boolean(),
        disabled: T.boolean(),
      },
    })),
    variant: T.string({
      defaultValue: "default",
      enum: ["default", "pills", "underline"],
    }),
    vertical: T.boolean(),
    responsive: T.boolean(),
    reorderable: false,
    fullWidth: false,
  },
  events: {
    "tab-change": T.number(),
    "tab-close": T.object(),
    "tab-reorder": T.object(),
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
    if (changedProps.has("tabs")) {
      this._listenTabSlot();
      this.updateActivePanels();
      this.equalizeTabWidths();
    }
  },

  firstUpdated() {
    const panelSlot = /** @type {HTMLSlotElement} */ (this.querySelector("slot[name=panel]"));

    panelSlot?.addEventListener("slotchange", () => {
      this.updateActivePanels();
    });

    this._listenTabSlot();
    this.updateActivePanels();
    this.equalizeTabWidths();

    this.addEventListener("keydown", (e) => {
      if (!(e instanceof KeyboardEvent)) return;

      const tabs = this._tabEls();
      if (!tabs.length) return;

      const target = /** @type {Element} */ (e.composedPath()[0]);
      const isInputElement = target.matches?.("input, textarea, select, [contenteditable]");
      const path = e.composedPath();
      const focused = tabs.find((tab) => path.includes(tab));
      if (isInputElement || !focused) return;

      const index = tabs.indexOf(focused);

      if ((e.key === "Delete" || e.key === "Backspace") && this._isClosable(focused)) {
        e.preventDefault();
        this._emitClose(index);
        return;
      }

      if (
        this.reorderable &&
        e.altKey &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        const step = this._reorderStep(e.key);
        if (step === 0) return;
        const to = index + step;
        if (to < 0 || to >= tabs.length) return;
        e.preventDefault();
        this._emitReorder(index, to);
        return;
      }

      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;

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

  _listenTabSlot() {
    const slot = /** @type {HTMLSlotElement | null} */ (this.querySelector("slot[name=tab]"));
    if (!slot || slot.dataset.lcTabsWired) return;
    slot.dataset.lcTabsWired = "1";
    slot.addEventListener("slotchange", () => {
      this.updateActivePanels();
      this.equalizeTabWidths();
    });
  },

  /** @returns {HTMLElement[]} */
  _tabEls() {
    const tabs = this.tabs;
    if (tabs.length)
      return /** @type {HTMLElement[]} */ ([...this.querySelectorAll("[data-lc-tab]")]);

    const slot = /** @type {HTMLSlotElement | null} */ (this.querySelector("slot[name=tab]"));
    return slot ? /** @type {HTMLElement[]} */ ([...slot.children]) : [];
  },

  /** @param {EventTarget | null} node @returns {HTMLElement | null} */
  _tabFromNode(node) {
    if (!(node instanceof Element)) return null;
    const item = node.closest("[part~=lc-tabs-item]");
    if (item) return /** @type {HTMLElement | null} */ (item.querySelector("[data-lc-tab]"));
    const found = node.closest("[data-lc-tab], [slot=tab]");
    return found instanceof HTMLElement ? found : null;
  },

  /** @param {EventTarget[]} path @param {HTMLElement[]} tabs */
  _indexFromPath(path, tabs) {
    for (const node of path) {
      const tab = this._tabFromNode(node);
      if (tab && tabs.includes(tab)) return tabs.indexOf(tab);
    }
    return -1;
  },

  /** @param {HTMLElement} tab */
  _isClosable(tab) {
    return tab.hasAttribute("closable");
  },

  /** @param {HTMLElement} tab @param {number} index */
  _tabId(tab, index) {
    if (tab.hasAttribute("data-lc-tab")) return this.tabs[index]?.id ?? null;
    return tab.dataset.lcId || null;
  },

  /** @param {number} index */
  _emitClose(index) {
    const tab = this._tabEls()[index];
    if (!tab) return;
    this.$emit("tab-close", { index, id: this._tabId(tab, index) });
  },

  /** @param {number} from @param {number} to */
  _emitReorder(from, to) {
    const tabs = this._tabEls();
    if (!tabs[from] || !tabs[to]) return;
    this.$emit("tab-reorder", {
      from,
      to,
      fromId: this._tabId(tabs[from], from),
      toId: this._tabId(tabs[to], to),
    });
  },

  /** @param {string} key */
  _reorderStep(key) {
    if (this.vertical) {
      if (key === "ArrowUp") return -1;
      if (key === "ArrowDown") return 1;
      return 0;
    }
    if (key === "ArrowLeft") return -1;
    if (key === "ArrowRight") return 1;
    return 0;
  },

  equalizeTabWidths() {
    const tabs = this._tabEls();
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

    if (!panelSlot) return;

    const panels = /** @type {Element[]} */ ([...panelSlot.children]);
    const tabs = this._tabEls();

    if (!this._tabsBaseId)
      this._tabsBaseId = this.id || uniqueId("lc-tabs-");

    const baseId = this._tabsBaseId;

    tabs.forEach((tab, index) => {
      const tabId = `${baseId}-tab-${index}`;
      const panelId = `${baseId}-panel-${index}`;

      if (!tab.hasAttribute("data-lc-tab") && !tab.dataset.lcId) {
        const identity = tab.getAttribute("value") ?? tab.getAttribute("data-id");
        if (identity) tab.dataset.lcId = identity;
      }

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
    const tabs = this._tabEls();
    const index = this._indexFromPath(e.composedPath(), tabs);
    if (index === -1) return;

    if (this._suppressClick) {
      this._suppressClick = false;
      return;
    }

    const tab = tabs[index];
    if (tab.hasAttribute("disabled") || /** @type {{ disabled?: boolean }} */ (tab).disabled) return;
    if (index === this.activeTab) return;
    this.activeTab = index;
    this.updateActivePanels();
    this.$emit("tab-change", index);
  },

  /** @param {MouseEvent} e */
  _onTabListClick(e) {
    const close = e.composedPath().find(
      (node) => node instanceof Element && node.matches?.("[part~=lc-tabs-close]"),
    );
    if (close) {
      e.preventDefault();
      e.stopPropagation();
      const tabs = this._tabEls();
      const tab = close instanceof Element ? this._tabFromNode(close) : null;
      const index = tab ? tabs.indexOf(tab) : -1;
      if (index !== -1) this._emitClose(index);
      return;
    }
    this.selectTab(e);
  },

  /** @param {MouseEvent} e */
  _onAuxClick(e) {
    if (e.button !== 1) return;
    const tabs = this._tabEls();
    const index = this._indexFromPath(e.composedPath(), tabs);
    if (index === -1 || !this._isClosable(tabs[index])) return;
    e.preventDefault();
    this._emitClose(index);
  },

  /** @param {PointerEvent} e */
  _onPointerDown(e) {
    if (!this.reorderable || e.button !== 0) return;

    const path = e.composedPath();
    if (path.some((node) => node instanceof Element && node.matches?.("[part~=lc-tabs-close]"))) return;

    const tabs = this._tabEls();
    const from = this._indexFromPath(path, tabs);
    if (from === -1) return;

    const tab = tabs[from];
    const moving = /** @type {HTMLElement} */ (tab.closest("[part~=lc-tabs-item]") ?? tab);
    const startX = e.clientX;
    const startY = e.clientY;
    /** @type {HTMLElement | null} */
    let over = null;
    let moved = false;

    /** @param {PointerEvent} ev */
    const move = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved) {
        moved = true;
        moving.setAttribute("dragging", "");
      }

      moving.style.transform = this.vertical ? `translateY(${dy}px)` : `translateX(${dx}px)`;

      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const found = this._tabFromNode(hit);
      const next = found && tabs.includes(found) ? found : null;

      if (over && over !== next) over.removeAttribute("drag-over");
      if (next && next !== tab) next.setAttribute("drag-over", "");
      over = next === tab ? null : next;
    };

    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);

      moving.removeAttribute("dragging");
      moving.style.transform = "";
      over?.removeAttribute("drag-over");

      if (!moved) return;

      this._suppressClick = true;
      setTimeout(() => { this._suppressClick = false; }, 0);

      if (!over || over === tab) return;
      const to = tabs.indexOf(over);
      if (to !== -1 && to !== from) this._emitReorder(from, to);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  },

  /** @param {TabItem} tab */
  _renderDataTab(tab) {
    return html`
      <div
        class="tab-item"
        role="presentation"
        part="lc-tabs-item"
        ?closable=${!!tab.closable}
        ?disabled=${!!tab.disabled}
      >
        <div
          slot="tab"
          part="lc-tabs-tab"
          data-lc-tab
          ?closable=${!!tab.closable}
          ?disabled=${!!tab.disabled}
          aria-disabled=${tab.disabled ? "true" : nothing}
        >
          ${tab.icon ? html`<lc-icon name=${tab.icon} size="sm"></lc-icon>` : nothing}
          <span class="label">${tab.label}</span>
          ${tab.badge ? html`<span part="lc-tabs-badge" class="badge">${tab.badge}</span>` : nothing}
        </div>
        ${tab.closable
          ? html`
            <button
              type="button"
              tabindex="-1"
              part="lc-tabs-close"
              class="close"
              aria-label=${lcText(TAG, "close", { label: tab.label })}
            >
              <lc-icon name="x" size="xs"></lc-icon>
            </button>
          `
          : nothing}
      </div>
    `;
  },

  render() {
    return html`
        <div
          part="lc-tabs-tab-list"
          role="tablist"
          aria-orientation=${this.vertical ? "vertical" : "horizontal"}
          @click=${this._onTabListClick}
          @auxclick=${this._onAuxClick}
          @pointerdown=${this._onPointerDown}
        >
          ${this.tabs.length
            ? this.tabs.map((tab) => this._renderDataTab(tab))
            : html`<slot name="tab" part="lc-tabs-tab"></slot>`}
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
 * Accessible tabs with keyboard navigation and flexible content. With
 * `reorderable`, a tab dragged with the pointer emits `tab-reorder`. A data
 * tab whose entry is `closable` draws its own close button; a slotted tab
 * marked `closable` closes from Delete, Backspace or a middle-click. Either
 * emits `tab-close`, and the component never moves or removes a tab itself:
 * the owner reorders or closes its data.
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
 * // Slotted closable tabs: Delete, Backspace and middle-click close them.
 * // The drawn close button comes with the `tabs` data below.
 * ```html
 * <lc-tabs reorderable @tab-close=${(e) => close(e.detail.id)} @tab-reorder=${(e) => move(e.detail.from, e.detail.to)}>
 *   <button slot="tab" value="one" closable>One</button>
 *   <button slot="tab" value="two" closable>Two</button>
 *   <div slot="panel">One</div>
 *   <div slot="panel">Two</div>
 * </lc-tabs>
 * ```
 *
 * @example
 * // Tabs from data, each closable entry with its own close button
 * ```js
 * html`<lc-tabs .tabs=${[
 *   { id: "inbox", label: "Inbox", badge: "3", closable: true },
 *   { id: "drafts", label: "Drafts", icon: "file-text" },
 * ]} @tab-close=${(e) => close(e.detail.id)}></lc-tabs>`
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
 * ```
 */
