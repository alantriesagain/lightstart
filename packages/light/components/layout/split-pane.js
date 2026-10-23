import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { withPointerDrag } from "../mixins/pointer-drag.js";

/** @import { Prop, DragMove } from "../types.ts" */

export default defineComponent({
  mixins: [withPointerDrag({ handle: "[part~=lc-split-pane-divider]", enabled: "resizable" })],
  tag: "lc-split-pane",
  props: {
    direction: "horizontal",
    initialSize: "50%",
    minSize: T.string(),
    maxSize: T.string(),
    minSecondary: "50px",
    primarySize: T.string({ sync: "local", scope: "storageKey" }),
    dividerSize: 2,
    storageKey: T.string(),
    resizable: false,

    _primaryPanel: /** @type {Prop<HTMLElement | null>} */ (
      T.object({ reactive: false, defaultValue: null })
    ),
    _secondaryPanel: /** @type {Prop<HTMLElement | null>} */ (
      T.object({ reactive: false, defaultValue: null })
    ),
    _start: /** @type {Prop<{ containerSize: number, primaryPx: number } | null>} */ (
      T.object({ reactive: false, defaultValue: null })
    ),
  },
  extends: "lc-flex",
  style: true,
  connected() {
    if (!this.primarySize) this.primarySize = this.initialSize;
  },
  firstUpdated() {
    const root = this;
    this._primaryPanel = /** @type {HTMLElement | null} */ (root.querySelector('[part="lc-split-pane-primary"]'));
    this._secondaryPanel = /** @type {HTMLElement | null} */ (root.querySelector('[part="lc-split-pane-secondary"]'));
  },

  /** @param {string} size */
  _parseSize(size) {
    if (!size) return null;
    const match = String(size).match(/^([\d.]+)(px|%)?$/);
    if (!match) return null;
    return {
      value: parseFloat(match[1]),
      unit: match[2] || "%",
    };
  },

  /**
   * @param {string} size
   * @param {number} containerSize
   */
  _toPixels(size, containerSize) {
    const parsed = this._parseSize(size);
    if (!parsed) return null;
    if (parsed.unit === "px") return parsed.value;
    return (parsed.value / 100) * containerSize;
  },

  onDragStart() {
    const rect = this.getBoundingClientRect();
    const containerSize = this.direction === "horizontal" ? rect.width : rect.height;
    this._start = { containerSize, primaryPx: this._toPixels(this.primarySize, containerSize) ?? 0 };
  },

  /** @param {DragMove} move */
  onDragMove({ dx, dy }) {
    const start = this._start;
    if (!start) return;
    const delta = this.direction === "horizontal" ? dx : dy;
    let primaryPx = start.primaryPx + delta;

    const minPx = this._toPixels(this.minSize, start.containerSize);
    const maxPx = this._toPixels(this.maxSize, start.containerSize);
    if (minPx !== null) primaryPx = Math.max(minPx, primaryPx);
    if (maxPx !== null) primaryPx = Math.min(maxPx, primaryPx);
    primaryPx = Math.min(primaryPx, start.containerSize - (this._toPixels(this.minSecondary, start.containerSize) ?? 50));

    if (this._primaryPanel && this._secondaryPanel) {
      this._primaryPanel.style.flexBasis = `${primaryPx}px`;
      this._secondaryPanel.style.flexBasis = `${start.containerSize - primaryPx}px`;
    }
    this.primarySize = `${primaryPx}px`;
  },

  onDragEnd() {
    this._start = null;
  },

  render() {
    const parsed = this._parseSize(this.primarySize);
    const primaryStyle = parsed
      ? `flex-basis: ${parsed.value}${parsed.unit}`
      : "flex-basis: 50%";

    return html`<slot name="primary" part="lc-split-pane-primary" style="${primaryStyle}"></slot>
      <div part="lc-split-pane-divider" style="--divider-size: ${this.dividerSize}px"></div>
      <slot part="lc-split-pane-secondary" name="secondary"></slot>`;
  },
});

/**
 * Copyright (c) Alan Carlos Meira Leal
 *
 * Split Pane Component
 *
 * @component
 * @category layout
 * @tag lc-split-pane
 *
 * A split pane layout for dividing space between two panels.
 * By default, the divider is non-resizable (just a visual separator).
 * Add the `resizable` attribute to enable drag-to-resize functionality.
 * Supports both pixel and percentage-based sizing.
 *
 * @slot primary - Primary (left/top) panel content
 * @slot secondary - Secondary (right/bottom) panel content
 * @part primary - Primary panel container
 * @part divider - Divider between panels
 * @part secondary - Secondary panel container
 *
 * @example Fixed Sidebar (Non-resizable)
 * ```html
 * <lc-split-pane initialSize="200px" minSize="200px">
 *   <div slot="primary">Fixed 200px sidebar</div>
 *   <div slot="secondary">Main content</div>
 * </lc-split-pane>
 * ```
 *
 * @example Resizable Split
 * ```html
 * <lc-split-pane initialSize="30%" resizable>
 *   <div slot="primary">Resizable panel</div>
 *   <div slot="secondary">Main content</div>
 * </lc-split-pane>
 * ```
 *
 * @example With Constraints
 * ```html
 * <lc-split-pane
 *   initialSize="250px"
 *   minSize="150px"
 *   maxSize="400px"
 *   resizable
 *   storageKey="editor-sidebar"
 * >
 *   <div slot="primary">Sidebar</div>
 *   <div slot="secondary">Editor</div>
 * </lc-split-pane>
 * ```
 */
