import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { navigation } from "@bootstrapp/light/navigation";

export default defineComponent({
  tag: "lc-story-circle",
  style: true,
  props: {
    src: "",
    name: "",
    seed: "",
    label: "",
    sub: "",
    href: "",
    ring: T.string({ defaultValue: "", enum: ["", "muted", "primary", "secondary", "highlight", "bar"] }),
    badgeIcon: "",
    badgeText: "",
    size: T.string({ defaultValue: "md", enum: ["md", "lg"] }),
    masked: false,
  },
  events: {
    select: T.object({ href: T.string() }),
  },
  /** @param {MouseEvent} e */
  _pick(e) {
    this.$emit("select", { href: this.href });
    if (this.href) navigation.click(e);
  },
  render() {
    const badge = this.badgeText || this.badgeIcon
      ? html`<span class="story-circle-badge" part="lc-story-circle-badge">${this.badgeIcon ? html`<lc-icon name=${this.badgeIcon} size="12"></lc-icon>` : ""}${this.badgeText ? html`<span>${this.badgeText}</span>` : ""}</span>`
      : "";
    const body = html`
      <span class="story-circle-media" part="lc-story-circle-media">
        <lc-avatar .src=${this.masked ? "" : this.src} .name=${this.masked ? "?" : this.name} .seed=${this.masked ? "?" : this.seed || this.name} ring=${this.ring}></lc-avatar>
        ${badge}
      </span>
      <span class="story-circle-label" part="lc-story-circle-label">${this.label || this.name}</span>
      ${this.sub ? html`<span class="story-circle-sub" part="lc-story-circle-sub">${this.sub}</span>` : ""}`;
    return this.href
      ? html`<a class="story-circle-hit" part="lc-story-circle-hit" href=${this.href} @click=${(/** @type {MouseEvent} */ e) => this._pick(e)}>${body}</a>`
      : html`<button type="button" class="story-circle-hit" part="lc-story-circle-hit" @click=${(/** @type {MouseEvent} */ e) => this._pick(e)}>${body}</button>`;
  },
});

/**
 * Story circle
 *
 * @component
 * @category display
 * @tag lc-story-circle
 *
 * One person, place or happening as a ringed circle with a line or two under
 * it, the unit a row of stories is made of. The circle is a `lc-avatar`, so
 * a photo, initials on a swatch or an icon all read the same; `ring` says the
 * state in a colour the theme names (`primary` for somebody out, `highlight`
 * for you, `muted` for off); a badge at the bottom right carries an icon (the
 * activity) or a short text (a count, an hour). `masked` hides who it is: a
 * question mark on a plain fill inside a dashed ring, the badge and the lines
 * kept, for somebody the reader may not see yet. Tapping it emits `select`,
 * and with `href` it is a link as well.
 *
 * @prop {string} src - The photo.
 * @prop {string} name - The name, drawn as the label when there is none.
 * @prop {string} seed - What picks the initials' swatch, else the name.
 * @prop {string} label - The first line under the circle.
 * @prop {string} sub - The second line, smaller and muted.
 * @prop {string} href - Where a tap goes, beside emitting `select`.
 * @prop {string} ring - `muted`, `primary`, `secondary`, `highlight` or `bar`; none for no ring.
 * @prop {string} badgeIcon - An icon in the badge.
 * @prop {string} badgeText - A short text in the badge.
 * @prop {string} size - `md` or `lg`.
 * @prop {boolean} masked - A question mark in place of the person.
 * @event select - `{ href }` when tapped.
 *
 * @example A row of who is around
 * ```html
 * <lc-story-circle name="Martina" ring="primary" badge-icon="umbrella" sub="Ipanema"></lc-story-circle>
 * <lc-story-circle src="/arpoador.jpg" name="Arpoador" ring="secondary" badge-text="6" sub="Meetup · 17:30"></lc-story-circle>
 * <lc-story-circle name="You" ring="highlight" label="You" sub="Beach · until 22:00"></lc-story-circle>
 * ```
 */
