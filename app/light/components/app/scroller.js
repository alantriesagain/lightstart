import { html } from "/app/light/html/index.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";
import { lcText } from "../utils/text.js";

/** @import { Prop } from "../types.js" */

export default defineComponent({
  tag: "lc-scroller",
  style: true,
  props: {
    gap: "0.75rem",
    pad: "0",
    chevrons: T.string({ defaultValue: "auto", enum: ["auto", "always", "never"] }),
    snap: false,
    _track: /** @type {Prop<HTMLElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _prev: /** @type {Prop<HTMLElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _next: /** @type {Prop<HTMLElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _raf: T.number({ reactive: false, defaultValue: 0 }),
  },
  firstUpdated() {
    const root = this;
    this._track = /** @type {HTMLElement | null} */ (root.querySelector(".track"));
    this._prev = /** @type {HTMLElement | null} */ (root.querySelector(".prev"));
    this._next = /** @type {HTMLElement | null} */ (root.querySelector(".next"));
    if (!this._track) return;

    const track = this._track;
    const onScroll = () => {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        this._sync();
      });
    };
    const observer = new ResizeObserver(() => this._sync());
    track.addEventListener("scroll", onScroll, { passive: true });
    observer.observe(track);
    this.$own(() => {
      track.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    });
    this._sync();
  },
  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("gap")) this.style.setProperty("--lc-scroller-gap", this.gap);
    if (changedProps.has("pad")) this.style.setProperty("--lc-scroller-pad", this.pad);
    this._sync();
  },
  /** @param {number} dir */
  _scroll(dir) {
    if (!this._track) return;
    this._track.scrollBy({ left: dir * this._track.clientWidth * 0.85, behavior: "smooth" });
  },
  _sync() {
    const t = this._track;
    if (!t || !this._prev || !this._next) return;
    const never = this.chevrons === "never";
    const always = this.chevrons === "always";
    const overflowing = t.scrollWidth > t.clientWidth + 1;
    const atStart = t.scrollLeft <= 0;
    const atEnd = t.scrollLeft + t.clientWidth >= t.scrollWidth - 1;
    this._prev.hidden = never || (!always && (!overflowing || atStart));
    this._next.hidden = never || (!always && (!overflowing || atEnd));
  },
  render() {
    return html`
      <button part="lc-scroller-nav lc-scroller-prev" class="nav prev" type="button" aria-label=${lcText("lc-scroller", "left")} hidden @click=${() => this._scroll(-1)}>
        <lc-icon name="chevron-left" size="18"></lc-icon>
      </button>
      <div part="lc-scroller-track" class="track"><slot @slotchange=${() => this._sync()}></slot></div>
      <button part="lc-scroller-nav lc-scroller-next" class="nav next" type="button" aria-label=${lcText("lc-scroller", "right")} hidden @click=${() => this._scroll(1)}>
        <lc-icon name="chevron-right" size="18"></lc-icon>
      </button>
    `;
  },
});

/**
 * Horizontal scroller
 *
 * @component
 * @category app
 * @tag lc-scroller
 *
 * A horizontal rail: the scrollbar is hidden and, where a pointer can hover, a
 * left/right chevron appears only in the direction there is more to see. On
 * touch it is a plain swipe. Slot in any row of `shrink-0` children (chips,
 * avatars, thumbnail cards). `snap` makes it a carousel: a swipe comes to
 * rest with a child centred, so full-width children page one at a time.
 * `--lc-scroller-height: 100%` lets the rail take the height the host is
 * given, for children that fill it.
 *
 * @prop {boolean} snap - Each swipe comes to rest on a child, centred.
 * @slot default - The row items (each should be `shrink-0`).
 * @part track - The scrolling container.
 * @part nav - Either chevron button.
 *
 * @example
 * ```html
 * <lc-scroller gap="0.75rem">
 *   <button class="shrink-0">…</button>
 *   <button class="shrink-0">…</button>
 * </lc-scroller>
 * ```
 */
