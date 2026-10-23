import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

/** @import { Prop, Renderable } from "../types.ts" */

export default defineComponent({
  tag: "lc-stat",
  props: {
    title: "",
    value: /** @type {Prop<Renderable>} */ (T.any("")),
    desc: "",
    size: T.string({
      defaultValue: "md",
      enum: ["sm", "md", "lg"],
    }),
    variant: T.string({
      defaultValue: "default",
      enum: [
        "default",
        "primary",
        "secondary",
        "success",
        "danger",
        "warning",
        "info",
      ],
    }),
    centered: false,
    delta: T.string(),
    trend: T.string({ enum: ["up", "down", "flat"], defaultValue: "flat" }),
  },
  style: true,

  render() {
    return html`
      <div part="lc-stat-figure">
        <slot name="figure"></slot>
      </div>
      <div part="lc-stat-body">
        ${this.title ? html`<div part="lc-stat-title">${this.title}</div>` : nothing}
        ${
          this.delta
            ? html`<div part="lc-stat-headline">
                ${this.value !== "" ? html`<div part="lc-stat-value">${this.value}</div>` : nothing}
                <span part=${`lc-stat-delta lc-stat-delta-${this.trend}`}>
                  ${
                    this.trend === "flat"
                      ? nothing
                      : html`<lc-icon name=${this.trend === "up" ? "arrow-up-right" : "arrow-down-right"} size="12" aria-hidden="true"></lc-icon>`
                  }${this.delta}
                </span>
              </div>`
            : this.value !== ""
              ? html`<div part="lc-stat-value">${this.value}</div>`
              : nothing
        }
        <div part="lc-stat-desc">
          ${this.desc ? this.desc : html`<slot></slot>`}
        </div>
      </div>
    `;
  },
});

/**
 * Stat Component
 *
 * @component
 * @category display
 * @tag lc-stat
 *
 * Display statistics with title, value, and description in a clean format.
 * Supports icons/figures and works great when grouped with lc-join.
 *
 * @slot default - Description content below the value
 * @slot figure - Icon, avatar, or image to display alongside the stat
 *
 * @part figure - Container for the figure slot
 * @part body - Container for title, value, and description
 * @part title - The stat title/label
 * @part value - The main stat value (hero element)
 * @part desc - Description text below the value
 * @part headline - The row holding the value and the delta pill, when `delta` is set
 * @part delta - The delta pill; also `delta-up`, `delta-down` or `delta-flat` by `trend`
 *
 * @example
 * // Basic stat
 * ```html
 * <lc-stat title="Total Users" value="1,234"></lc-stat>
 * ```
 *
 * @example
 * // With description
 * ```html
 * <lc-stat title="Downloads" value="31K" desc="Jan 1st - Feb 1st"></lc-stat>
 * ```
 *
 * @example
 * // With icon figure
 * ```html
 * <lc-stat title="Total Likes" value="25.6K" variant="primary">
 *   <lc-icon slot="figure" name="heart" size="lg"></lc-icon>
 *   21% more than last month
 * </lc-stat>
 * ```
 *
 * @example
 * // With colored variants
 * ```html
 * <lc-stat title="Active" value="85" variant="success">↑ 12%</lc-stat>
 * <lc-stat title="Errors" value="3" variant="danger">↓ 5%</lc-stat>
 * ```
 *
 * @example
 * // Grouped stats with lc-join
 * ```html
 * <lc-join>
 *   <lc-stat title="Downloads" value="31K">Jan 1st - Feb 1st</lc-stat>
 *   <lc-stat title="New Users" value="4,200">↑ 400 (22%)</lc-stat>
 *   <lc-stat title="New Registers" value="1,200">↓ 90 (14%)</lc-stat>
 * </lc-join>
 * ```
 *
 * @example
 * // Stats with icons grouped
 * ```html
 * <lc-join>
 *   <lc-stat title="Total Likes" value="25.6K" variant="primary">
 *     <lc-icon slot="figure" name="heart"></lc-icon>
 *     21% more than last month
 *   </lc-stat>
 *   <lc-stat title="Page Views" value="2.6M" variant="secondary">
 *     <lc-icon slot="figure" name="zap"></lc-icon>
 *     21% more than last month
 *   </lc-stat>
 * </lc-join>
 * ```
 *
 * @example
 * // With a delta pill
 * ```html
 * <lc-stat title="Reach" value="48.2K" delta="12.4%" trend="up"></lc-stat>
 * ```
 *
 * @example
 * // Centered stats
 * ```html
 * <lc-join>
 *   <lc-stat title="Passed" value="85" variant="success" centered></lc-stat>
 *   <lc-stat title="Failed" value="3" variant="danger" centered></lc-stat>
 *   <lc-stat title="Pending" value="12" variant="warning" centered></lc-stat>
 * </lc-join>
 * ```
 */
