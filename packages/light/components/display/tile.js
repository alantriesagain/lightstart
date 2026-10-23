import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

const ASPECTS = ["1/1", "9/16", "16/9", "4/5", "auto"];

export default defineComponent({
  tag: "lc-tile",
  style: true,
  props: {
    src: "",
    alt: "",
    icon: "",
    label: "",
    meta: "",
    badge: "",
    aspect: T.string({ defaultValue: "1/1", enum: ASPECTS }),
    size: T.string({ defaultValue: "md", enum: ["sm", "md", "lg", "fill"] }),
    selected: false,
    disabled: false,
    loading: false,
    interactive: false,
  },
  events: {
    select: T.object({}),
  },
  connected() {
    this._reflectInteractive();
  },
  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("interactive") || changedProps.has("disabled")) this._reflectInteractive();
  },
  _reflectInteractive() {
    if (this.interactive && !this.disabled) {
      this.setAttribute("role", "button");
      this.setAttribute("tabindex", "0");
    } else {
      this.removeAttribute("role");
      this.removeAttribute("tabindex");
    }
  },
  /** @param {Event} e */
  _activate(e) {
    if (!this.interactive || this.disabled) return;
    if (e instanceof KeyboardEvent) {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
    }
    this.$emit("select", {});
  },
  render() {
    const media = this.loading
      ? html`<span part="lc-tile-shimmer" class="shimmer"></span>`
      : this.src
        ? html`<img part="lc-tile-image" src=${this.src} alt=${this.alt} loading="lazy" />`
        : this.icon
          ? html`<lc-icon part="lc-tile-icon" class="icon" name=${this.icon} size="lg"></lc-icon>`
          : nothing;
    return html`
      <div part="lc-tile-media" class="media" style="--lc-tile-aspect: ${this.aspect === "auto" ? "auto" : this.aspect.replace("/", " / ")}" @click=${this._activate} @keydown=${this._activate}>
        <slot name="media">${media}</slot>
        <slot name="badge">${this.badge && !this.loading ? html`<span part="lc-tile-badge" class="badge">${this.badge}</span>` : nothing}</slot>
        <div part="lc-tile-actions" class="actions"><slot name="actions"></slot></div>
      </div>
      <slot name="footer">
        ${this.label || this.meta
          ? html`<div part="lc-tile-footer" class="footer" @click=${this._activate}>${this.label ? html`<span part="lc-tile-label" class="label">${this.label}</span>` : nothing}${this.meta ? html`<span part="lc-tile-meta" class="meta">${this.meta}</span>` : nothing}</div>`
          : nothing}
      </slot>
    `;
  },
});

/**
 * Tile Component
 *
 * @component
 * @category display
 * @tag lc-tile
 *
 * A thumbnail with a name under it: a project cover, a media file, a template,
 * an effect. The media area keeps its aspect, carries a kind badge in one
 * corner and actions in the other, and shimmers while `loading`. Slots
 * `media`, `badge`, `actions` and `footer` replace each part; `interactive`
 * makes the tile a button that emits `select` on click, Enter or Space, and
 * `selected` draws the selection ring.
 *
 * @example A media file
 * ```html
 * <lc-tile src="/media/cover.jpg" label="lisbon-night.jpg" meta="4:5 · 2.1 MB" badge="JPG" interactive></lc-tile>
 * ```
 *
 * @example A drawn cover and a portrait aspect
 * ```html
 * <lc-tile aspect="9/16" label="Agent demo reel" meta="Video · 9:16">
 *   <div slot="media" style="width: 100%; height: 100%; background: linear-gradient(160deg, #1d2a44, #0f1526)"></div>
 * </lc-tile>
 * ```
 */
