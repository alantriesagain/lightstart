import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

const SWATCH_COUNT = 8;

export default defineComponent({
  tag: "lc-avatar",
  props: {
    src: T.string(),
    name: T.string(),
    seed: T.string(),
    size: T.string({
      defaultValue: "md",
      enum: ["xs", "sm", "md", "lg", "xl"],
    }),
    shape: T.string({
      defaultValue: "circle",
      enum: ["circle", "square", "rounded"],
    }),
    status: T.string({
      enum: ["online", "offline", "busy", "away"],
    }),
    ring: T.string({
      defaultValue: "",
      enum: ["", "muted", "primary", "secondary", "highlight", "bar"],
    }),
    icon: "user",
    _failed: T.boolean({ attribute: false, defaultValue: false }),
  },
  style: true,

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  willUpdate({ changedProps }) {
    if (changedProps.has("src")) this._failed = false;
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (!(changedProps.has("seed") || changedProps.has("name") || changedProps.has("src") || changedProps.has("_failed"))) return;
    const key = this.seed || this.name;
    if (!key || (this.src && !this._failed)) return this.style.removeProperty("--lc-avatar-fill");
    const i = [...String(key)].reduce((a, c) => a + c.charCodeAt(0), 0) % SWATCH_COUNT;
    const hue = Math.round((i * 360) / SWATCH_COUNT);
    this.style.setProperty("--lc-avatar-fill", `var(--lc-avatar-swatch-${i}, hsl(${hue} 60% 85%))`);
  },

  /** @param {string} name */
  getInitials(name) {
    if (!name) return null;
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1)
      return parts[0].substring(0, 2).toUpperCase();

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  render() {
    const initials = this.getInitials(this.name);

    return html`
      ${this.src && !this._failed
        ? html`<img src="${this.src}" alt="${this.name || lcText("lc-avatar", "alt")}" @error=${() => { this._failed = true; }} />`
        : initials
          ? html`<span class="initials">${initials}</span>`
          : html`<lc-icon name=${this.icon}></lc-icon>`
      }
      ${this.status
        ? html`<span class="status status--${this.status}"></span>`
        : ""
      }
    `;
  },
});

/**
 * Avatar Component
 *
 * @component
 * @category display
 * @tag lc-avatar
 *
 * Displays user profile images, initials, or a fallback icon (`icon`, the
 * user glyph by default: a place's thumbnail says `map-pin`, a group's
 * `message-circle`). An image that fails to load falls back the same way, so
 * a dead URL never leaves a broken frame.
 * Supports status indicators and multiple shapes/sizes. The fill behind
 * initials is one of eight swatches picked from `seed` (else `name`) and
 * written to `--lc-avatar-fill`; `ring` draws a ring around the whole avatar
 * in a named colour, with a gap the colour of the surface, which is how a
 * person's state (out, hosting, you) reads on a row of circles.
 *
 * @example Ringed
 * ```html
 * <lc-avatar name="Martina" ring="primary"></lc-avatar>
 * <lc-avatar name="You" ring="highlight"></lc-avatar>
 * <lc-avatar name="Tom" ring="muted"></lc-avatar>
 * ```
 *
 * @example Image Avatar
 * ```html
 * <lc-avatar src="/path/to/image.jpg" name="John Doe"></lc-avatar>
 * ```
 *
 * @example Initials Avatar
 * ```html
 * <lc-avatar name="Jane Smith"></lc-avatar>
 * <lc-avatar name="Bob"></lc-avatar>
 * ```
 *
 * @example Default Icon (no name or src)
 * ```html
 * <lc-avatar></lc-avatar>
 * <lc-avatar size="lg"></lc-avatar>
 * ```
 *
 * @example Sizes
 * ```html
 * <lc-avatar name="XS" size="xs"></lc-avatar>
 * <lc-avatar name="SM" size="sm"></lc-avatar>
 * <lc-avatar name="MD" size="md"></lc-avatar>
 * <lc-avatar name="LG" size="lg"></lc-avatar>
 * <lc-avatar name="XL" size="xl"></lc-avatar>
 * ```
 *
 * @example Shapes
 * ```html
 * <lc-avatar name="C" shape="circle"></lc-avatar>
 * <lc-avatar name="S" shape="square"></lc-avatar>
 * <lc-avatar name="R" shape="rounded"></lc-avatar>
 * ```
 *
 * @example Status Indicator
 * The dot sits on the avatar's lower right; `--lc-avatar-status-ring-color`
 * is the rim that parts it from what is behind (the surface by default, so a
 * dark bar sets its own colour).
 * ```html
 * <lc-avatar name="John" status="online"></lc-avatar>
 * <lc-avatar name="Jane" status="offline"></lc-avatar>
 * <lc-avatar name="Bob" status="busy"></lc-avatar>
 * <lc-avatar name="Alice" status="away"></lc-avatar>
 * ```
 */
