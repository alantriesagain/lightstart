import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

/** @import { Prop } from "../types.ts" */

export default defineComponent({
  tag: "lc-palette",
  style: true,
  props: {
    colors: /** @type {Prop<string[]>} */ (T.array({ defaultValue: [] })),
    label: "",
    meta: "",
    selected: false,
    interactive: false,
    size: T.string({ defaultValue: "md", enum: ["sm", "md"] }),
  },
  events: {
    select: T.object({ colors: T.array() }),
  },
  connected() {
    this._reflect();
  },
  firstUpdated() {
    this.addEventListener("click", (e) => this._activate(e));
    this.addEventListener("keydown", (e) => this._activate(e));
  },
  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (["interactive", "selected", "colors"].some((key) => changedProps.has(key))) this._reflect();
  },
  _reflect() {
    if (!this.interactive) {
      for (const name of ["role", "tabindex", "aria-pressed", "aria-label"]) this.removeAttribute(name);
      return;
    }
    this.setAttribute("role", "button");
    this.setAttribute("tabindex", "0");
    this.setAttribute("aria-pressed", String(this.selected));
    this.setAttribute("aria-label", this.colors.join(", "));
  },
  /** @param {Event} e */
  _activate(e) {
    if (!this.interactive) return;
    if (e instanceof KeyboardEvent) {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
    }
    this.$emit("select", { colors: [...this.colors] });
  },
  render() {
    return html`
      <div part="lc-palette-stripes" class="stripes">
        ${this.colors.map((color) => html`<span part="lc-palette-stripe" class="stripe" style="background: ${color}"></span>`)}
      </div>
      ${this.label || this.meta
        ? html`<div part="lc-palette-line" class="line"><span part="lc-palette-label" class="label">${this.label}</span><span part="lc-palette-meta" class="meta">${this.meta}</span></div>`
        : nothing}
    `;
  },
});

/**
 * Palette Component
 *
 * @component
 * @category display
 * @tag lc-palette
 *
 * A colour palette as one rounded row of equal stripes, with an optional line
 * under it: a label on the left and a meta value on the right. `selected`
 * draws a ring around the stripes; `interactive` makes the palette a button
 * that emits `select` with its colours on click, Enter or Space.
 *
 * @part stripes - The rounded row
 * @part stripe - One colour
 * @part line - The label and meta line
 * @part label - The text on the left
 * @part meta - The text on the right
 *
 * @example
 * ```html
 * <lc-palette .colors=${["#364f6b", "#3fc1c9", "#f5f5f5", "#fc5185"]} meta="27k" interactive selected></lc-palette>
 * ```
 */
