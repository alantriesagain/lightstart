import { defineComponent } from "/app/light/view/index.js";
import T from "/app/light/types/types.js";
import { withPointerDrag } from "/app/light/components/mixins/pointer-drag.js";
import { DISMISS_ZONE_PX, classify, releaseVelocity, resolveStops, rubber } from "/app/light/components/overlay/detents.js";
import { env } from "/app/light/env/index.js";

/** @import { DetentName, DetentStops, DragMove, PanelDrag, Prop } from "/app/light/components/types.js" */
/** @import { LiveSpring } from "/app/anim/index.js" */

/** @type {typeof import("/app/anim/index.js") | undefined} */
let anim;
/** @type {Promise<typeof import("/app/anim/index.js")> | undefined} */
let animLoading;
const loadAnim = () => (anim ? Promise.resolve(anim) : (animLoading ??= import("/app/anim/index.js").then((m) => (anim = m))));

const DETENTS = /** @type {const} */ (["closed", "half", "full"]);

/**
 * @param {string} value
 * @returns {value is DetentName}
 */
const isDetent = (value) => DETENTS.some((d) => d === value);

const SUPPRESS_CLICK_MS = 350;

/**
 * A length the app wrote as an expression (`calc`, `min`, `env`) resolves by
 * measuring it, since a custom property computes to its text and not to pixels.
 * @param {HTMLElement} host
 * @param {string} raw
 * @param {number} fallbackPx
 */
const measurePx = (host, raw, fallbackPx) => {
  const probe = document.createElement("div");
  probe.style.cssText = `position:fixed;left:-9999px;top:0;width:0;pointer-events:none;height:${raw}`;
  (host.parentElement || document.body).append(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return px > 0 ? px : fallbackPx;
};

/**
 * @param {HTMLElement} host
 * @param {string} name
 * @param {number} fallbackPx
 */
const cssPx = (host, name, fallbackPx) => {
  const raw = getComputedStyle(host).getPropertyValue(name).trim();
  if (!raw) return fallbackPx;
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n)) return measurePx(host, raw, fallbackPx);
  if (raw.endsWith("rem")) return n * Number.parseFloat(getComputedStyle(document.documentElement).fontSize || "16");
  if (/(dvh|vh|svh|lvh|%)$/.test(raw)) return (n / 100) * env.height;
  return n;
};

export default defineComponent({
  mixins: [withPointerDrag({ handle: "[data-drag-handle]", capture: false, touchFallback: true })],
  tag: "anim-drag-panel",
  style: true,
  props: {
    detent: /** @type {Prop<DetentName>} */ (T.string({ defaultValue: "closed" })),
    _classified: T.string({ reactive: false, defaultValue: "" }),
    _suppressClick: T.boolean({ reactive: false, defaultValue: false }),
    _y: /** @type {Prop<number | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _spring: /** @type {Prop<LiveSpring | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _raf: T.number({ reactive: false, defaultValue: 0 }),
    _lastT: T.number({ reactive: false, defaultValue: 0 }),
    _sheet: /** @type {Prop<PanelDrag | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _clickTimer: /** @type {Prop<ReturnType<typeof setTimeout> | null>} */ (T.object({ reactive: false, defaultValue: null })),
  },

  connected() {
    this._y = null;
    this._spring = null;
    this._raf = 0;
    this._lastT = 0;
    this._sheet = null;

    const onClick = /** @type {EventListener} */ ((e) => {
      if (!this._suppressClick) return;
      e.stopPropagation();
      e.preventDefault();
    });
    this.addEventListener("click", onClick, { capture: true });
    this.$own(() => {
      this.removeEventListener("click", onClick, { capture: true });
      if (this._clickTimer) clearTimeout(this._clickTimer);
      this._clickTimer = null;
    });

    this.$own(env.subscribe(() => {
      if (this._sheet || this._spring) return;
      this._applyDetent(this.detent, { animate: false });
    }));

    const initial = requestAnimationFrame(() => this._applyDetent(this.detent, { animate: false }));
    this.$own(() => {
      cancelAnimationFrame(initial);
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    });
    return loadAnim().then(() => undefined);
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  willUpdate({ changedProps }) {
    if (!changedProps.has("detent") || !this.detent) return;
    if (this.detent === this._classified) return;
    this._classified = this.detent;
    if (this._y != null) this._applyDetent(this.detent, { animate: true });
  },

  _holdClick() {
    this._suppressClick = true;
    if (this._clickTimer) clearTimeout(this._clickTimer);
    this._clickTimer = setTimeout(() => {
      this._clickTimer = null;
      this._suppressClick = false;
    }, SUPPRESS_CLICK_MS);
  },

  _stops() {
    return resolveStops({
      height: this.offsetHeight,
      halfPx: cssPx(this, "--anim-drag-panel-half", env.height * 0.44),
      peekPx: cssPx(this, "--anim-drag-panel-peek", 58) + cssPx(this, "--anim-drag-panel-gutter", 0),
    });
  },

  /** @param {number} y */
  _write(y) {
    this._y = y;
    this.style.transform = `translateY(${y}px)`;
  },

  /** @param {number} t */
  _tick(t) {
    this._raf = 0;
    const dt = Math.min(50, t - (this._lastT || t));
    this._lastT = t;
    if (this._spring) {
      this._spring.step(dt);
      const y = this._spring.value;
      if (Math.abs(y - this._spring.target) < 0.5 && Math.abs(this._spring.velocity) < 20) {
        this._write(this._spring.target);
        this._spring = null;
        this.style.willChange = "";
        return;
      }
      this._write(y);
      this._raf = requestAnimationFrame((n) => this._tick(n));
    }
  },

  _start() {
    if (!this._raf) {
      this._lastT = 0;
      this._raf = requestAnimationFrame((n) => this._tick(n));
    }
  },

  onDragStart() {
    const stops = this._stops();
    const velocity = this._spring ? this._spring.velocity : 0;
    this._spring = null;
    this.style.willChange = "transform";
    const base = this._y ?? stops[isDetent(this.detent) ? this.detent : "closed"];
    this._sheet = { base, stops, moved: false, samples: [], startVelocity: velocity };
    this._write(base);
  },

  /** @param {DragMove} move */
  onDragMove({ dy, y: clientY }) {
    const d = this._sheet;
    if (!d) return;
    if (Math.abs(dy) > 4) d.moved = true;
    let y = d.base + dy;
    if (y < d.stops.full) y = d.stops.full - rubber(d.stops.full - y);
    else if (y > d.stops.closed) y = d.stops.closed + rubber(y - d.stops.closed);
    d.samples.push({ t: performance.now(), y: clientY });
    if (d.samples.length > 12) d.samples.shift();
    this._write(y);
  },

  onDragEnd() {
    const d = this._sheet;
    this._sheet = null;
    if (!d) return;
    if (!d.moved) {
      this.style.willChange = "";
      return;
    }
    this._holdClick();
    const velocityPxS = releaseVelocity(d.samples, performance.now()) * 1000;
    const y = this._y ?? d.base;
    if (y < d.stops.full || y > d.stops.closed)
      this._springTo(y < d.stops.full ? d.stops.full : d.stops.closed, velocityPxS);
     else if (y >= d.stops.closed - DISMISS_ZONE_PX) {
      this._springTo(d.stops.closed, velocityPxS);
      this._label("closed");
      this.$emit("panel-dismissed");
      return;
    } else
      this.style.willChange = "";

    this._label(classify(d.stops, y) === "closed" ? "half" : classify(d.stops, y));
  },

  /** @param {string} detent */
  _label(detent) {
    if (!isDetent(detent) || detent === this.detent) {
      this._classified = this.detent;
      return;
    }
    this._classified = detent;
    this.detent = detent;
    this.$emit("detent-changed", { detent });
  },

  /**
   * @param {number} target
   * @param {number} [velocityPxS]
   */
  _springTo(target, velocityPxS = 0) {
    if (!anim) {
      loadAnim().then(() => this._springTo(target, velocityPxS));
      return;
    }
    this.style.willChange = "transform";
    this._spring = anim.createSpring({ value: this._y ?? target, target, velocity: velocityPxS, stiffness: 260, damping: 30 });
    this._start();
  },

  /**
   * @param {string} detent
   * @param {{ animate: boolean }} arg
   */
  _applyDetent(detent, { animate }) {
    const stops = this._stops();
    const target = isDetent(detent) ? stops[detent] : stops.closed;
    if (animate && this._y != null) this._springTo(target, this._spring?.velocity ?? 0);
    else {
      this._spring = null;
      this._write(target);
    }
  },

  /** @param {string} detent */
  setDetent(detent) {
    if (!isDetent(detent)) return;
    this._classified = detent;
    if (detent !== this.detent) {
      this.detent = detent;
      this.$emit("detent-changed", { detent });
    }
    this._applyDetent(detent, { animate: true });
  },

  resetScroll() {
    const body = this.querySelector("[data-drag-body]");
    if (body) body.scrollTop = 0;
  },

  positionPx() {
    return this._y ?? 0;
  },
});

/**
 * Drag Panel Component
 *
 * @component
 * @category overlay
 * @tag anim-drag-panel
 *
 * A light-DOM bottom panel the finger owns: dragging the `[data-drag-handle]`
 * child moves the panel 1:1 and it STAYS where it is released: the named
 * stops (`closed` | `half` | `full`) are labels and tap/programmatic targets,
 * not magnets. `setDetent()` snaps with a velocity-preserving spring, drops
 * near the bottom dismiss (`panel-dismissed`), and drags past either bound
 * rubber-band. Content scrolls inside the `[data-drag-body]` child.
 *
 * The panel is positioned by an inline transform on the host, which no
 * stylesheet rule on a part can override, the way an outer rule on a shadow
 * part used to beat the inline style on it.
 *
 * @example
 * ```html
 * <anim-drag-panel detent="half" @detent-changed=${(e) => this.onDetent(e.detail.detent)}>
 *   <div data-drag-handle>3 meetups · 30 events</div>
 *   <div data-drag-body>…</div>
 * </anim-drag-panel>
 * ```
 */
