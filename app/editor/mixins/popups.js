/**
 * withPopups: a tooltip anchored to a position and a completion list at the
 * caret, both fed by registered sources and rendered with the house
 * templating into a layer above the content.
 */

/** @import { EditorMixinDefinition } from "../types.js" */
import { html, render } from "/app/__light-runtime__.js";
import { effect, signal } from "/app/light/signals/index.js";
import T from "/app/light/types/types.js";
import { defineMixin } from "/app/light/view/index.js";

/**
 * @typedef {{ label: string, detail?: string, apply: (editor: unknown, from: number, to: number) => void }} CompletionOption
 * @typedef {{ from: number, to: number, options: CompletionOption[], filter?: boolean }} CompletionResult
 */

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
const handle = (value) => ({ reactive: false, defaultValue: value });

/**
 * @param {CompletionOption[]} options
 * @param {string} typed
 * @returns {CompletionOption[]}
 */
export const filterOptions = (options, typed) => {
  const needle = typed.toLowerCase();
  if (!needle) return options;
  return options.filter((o) => o.label.toLowerCase().includes(needle));
};

export const withPopups = defineMixin(/** @satisfies {EditorMixinDefinition} */ ({
  props: {
    _edLayer: T.object(handle(null)),
    _edTooltipEl: T.object(handle(null)),
    _edCompletionEl: T.object(handle(null)),
    _edCompletion: T.object(handle(null)),
    _edCompletionSelected: T.object(handle(null)),
  },

  get completionOpen() {
    return this._edCompletion.value !== null;
  },

  connected() {
    const layer = document.createElement("div");
    layer.className = "ed-popups";
    const tooltip = document.createElement("div");
    tooltip.className = "ed-popup ed-tooltip";
    tooltip.hidden = true;
    const completion = document.createElement("div");
    completion.className = "ed-popup ed-completion";
    completion.setAttribute("role", "listbox");
    completion.hidden = true;
    layer.append(tooltip, completion);
    this.appendChild(layer);
    this._edLayer = layer;
    this._edTooltipEl = tooltip;
    this._edCompletionEl = completion;
    this._edCompletion = signal(/** @type {CompletionResult | null} */ (null));
    this._edCompletionSelected = signal(0);
    const stop = (/** @type {Event} */ e) => e.preventDefault();
    layer.addEventListener("mousedown", stop);
    this.$own(() => layer.removeEventListener("mousedown", stop));
    const tooltips = effect(() => this.renderTooltip());
    const completions = effect(() => this.renderCompletion());
    this.$own(() => {
      tooltips.dispose();
      completions.dispose();
    });
    this.$own(
      this.addKeymap({
        ArrowDown: () => this.moveCompletion(1),
        ArrowUp: () => this.moveCompletion(-1),
        Enter: () => this.acceptCompletion(),
        Tab: () => this.acceptCompletion(),
        Escape: () => {
          if (!this.completionOpen) return false;
          this.closeCompletion();
          return true;
        },
      }),
    );
  },

  /**
   * @param {HTMLElement} el
   * @param {number} pos
   * @param {"above" | "below"} side
   */
  placePopup(el, pos, side) {
    const rect = this.coordsAtPos(pos);
    const host = this.getBoundingClientRect();
    if (!rect) return;
    el.hidden = false;
    const left = Math.max(0, Math.min(rect.left - host.left, host.width - el.offsetWidth - 4));
    const top = side === "above" ? rect.top - host.top - el.offsetHeight - 6 : rect.bottom - host.top + 4;
    el.style.left = `${left}px`;
    el.style.top = `${Math.max(0, top)}px`;
  },

  renderTooltip() {
    this._edDoc.value;
    this._edSelection.value;
    this._edPlugins.value;
    const el = /** @type {HTMLElement} */ (this._edTooltipEl);
    for (const source of this._edRegistries.tooltips) {
      const tip = source(this);
      if (!tip) continue;
      render(tip.render(), el);
      this.placePopup(el, tip.pos, "above");
      return;
    }
    el.hidden = true;
  },

  startCompletion() {
    for (const source of this._edRegistries.completions) {
      const result = /** @type {CompletionResult | null} */ (source(this));
      if (result && result.options.length) {
        this._edCompletionSelected.value = 0;
        this._edCompletion.value = result;
        return true;
      }
    }
    this.closeCompletion();
    return false;
  },

  closeCompletion() {
    this._edCompletion.value = null;
  },

  /**
   * @returns {CompletionOption[]}
   */
  visibleOptions() {
    const result = /** @type {CompletionResult | null} */ (this._edCompletion.value);
    if (!result) return [];
    const typed = this.sliceString(result.from, Math.min(this.selection.head, this.doc.length));
    return result.filter === false ? result.options : filterOptions(result.options, typed.replace(/^\W/, ""));
  },

  renderCompletion() {
    const result = /** @type {CompletionResult | null} */ (this._edCompletion.value);
    const el = /** @type {HTMLElement} */ (this._edCompletionEl);
    this._edDoc.value;
    const head = this._edSelection.value.head;
    if (!result || head < result.from) {
      el.hidden = true;
      if (result) queueMicrotask(() => this.closeCompletion());
      return;
    }
    const options = /** @type {CompletionOption[]} */ (this.visibleOptions());
    if (!options.length) {
      el.hidden = true;
      return;
    }
    const selected = Math.min(this._edCompletionSelected.value, options.length - 1);
    render(
      html`${options.map(
        (o, i) => html`<div class="ed-completion-item" role="option" aria-selected=${i === selected ? "true" : "false"} @click=${() => this.applyCompletion(o)}>
          <span>${o.label}</span>${o.detail ? html`<span class="ed-completion-detail">${o.detail}</span>` : ""}
        </div>`,
      )}`,
      el,
    );
    this.placePopup(el, result.from, "below");
  },

  /**
   * @param {number} delta
   * @returns {boolean}
   */
  moveCompletion(delta) {
    if (!this.completionOpen) return false;
    const count = this.visibleOptions().length;
    if (!count) return false;
    this._edCompletionSelected.value = (this._edCompletionSelected.value + delta + count) % count;
    return true;
  },

  /**
   * @returns {boolean}
   */
  acceptCompletion() {
    if (!this.completionOpen) return false;
    const options = this.visibleOptions();
    const option = options[Math.min(this._edCompletionSelected.value, options.length - 1)];
    if (!option) return false;
    this.applyCompletion(option);
    return true;
  },

  /**
   * @param {CompletionOption} option
   */
  applyCompletion(option) {
    const result = /** @type {CompletionResult | null} */ (this._edCompletion.value);
    if (!result) return;
    const to = Math.max(result.to, this.selection.head);
    this.closeCompletion();
    option.apply(this, result.from, to);
    this.focusEditor();
  },
}));
