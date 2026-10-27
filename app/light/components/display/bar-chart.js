import { html } from "/app/light/html/index.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";
import { compactNumber, niceMax } from "../utils/scale.js";
import { lcText } from "../utils/text.js";
/** @import { Prop, BarChartDatum } from "../types.js" */

export default defineComponent({
  tag: "lc-bar-chart",
  style: true,

  props: {
    data: /** @type {Prop<BarChartDatum[]>} */ (T.array({ defaultValue: [] })),
    height: 200,
    variant: T.string({
      defaultValue: "primary",
      enum: ["primary", "secondary", "success", "warning", "error", "info"],
    }),
    showLabels: true,
    showValues: false,
    horizontal: false,
    gap: 4,
    currentIndex: -1,
    showAxis: T.boolean(),
    formatValue: /** @type {Prop<((value: number) => string) | null>} */ (T.object({ attribute: false, defaultValue: null })),
    callout: T.string(),
  },

  /** @param {number} value */
  _format(value) {
    return this.formatValue ? this.formatValue(value) : compactNumber(value);
  },

  /**
   * @param {number} max
   * @param {boolean} withLabels
   */
  _bars(max, withLabels) {
    return this.data.map((item, i) => {
      const value = item.value || 0;
      const current = i === this.currentIndex;
      const state = current ? "current" : value ? "filled" : "empty";
      const extent = `${(value / max) * 100}%`;
      const callout = current && this.callout && !this.horizontal;
      if (this.horizontal)
        return html`
          <div class="bar-group" data-state=${state}>
            ${withLabels ? html`<span class="bar-label" title=${item.label}>${item.label}</span>` : ""}
            <div class="bar-track"><div class="bar" style=${`width:${extent}`} title="${item.label}: ${value}"></div></div>
            ${this.showValues || current ? html`<span class="bar-value">${value}</span>` : ""}
          </div>`;
      return html`
        <div class="bar-group" data-state=${state}>
          ${(this.showValues || current) && !callout
            ? html`<span class="bar-value">${value}</span>`
            : ""}
          <div
            class="bar"
            style=${`height:${extent}`}
            title="${item.label}: ${value}"
          >${callout ? html`<span class="bar-callout">${this.callout}</span>` : ""}</div>
          ${withLabels ? html`<span class="bar-label" title=${item.label}>${item.label}</span>` : ""}
        </div>`;
    });
  },

  render() {
    if (!this.data.length) return html`<div class="bar-chart-empty">${lcText("lc-chart", "noData")}</div>`;
    const max = Math.max(...this.data.map((d) => d.value || 0), 1);
    const chartClass = `bar-chart bar-chart-${this.variant}${this.horizontal ? " is-horizontal" : ""}`;
    const roomy = this.callout && !this.horizontal && this.data[this.currentIndex] ? " has-callout" : "";

    if (!this.showAxis || this.horizontal)
      return html`
        <div
          class=${chartClass + roomy}
          style="height:${this.horizontal ? "auto" : `${this.height}px`};gap:${this.gap}px"
        >
          ${this._bars(max, this.showLabels)}
        </div>`;

    const top = niceMax(max);
    const ticks = [0, 1, 2, 3, 4].map((step) => ({ value: (top * step) / 4, at: step * 25 }));
    return html`
      <div class="bar-chart-frame${roomy}" style="height:${this.height}px">
        <div class="bar-axis">
          ${ticks.map((tick) => html`<span class="bar-tick" style="bottom:${tick.at}%">${this._format(tick.value)}</span>`)}
        </div>
        <div class="bar-plot">
          ${ticks.map((tick) => html`<span class="bar-gridline" style="bottom:${tick.at}%"></span>`)}
          <div class=${chartClass} style="height:100%;gap:${this.gap}px">
            ${this._bars(top, false)}
          </div>
        </div>
      </div>
      ${this.showLabels
        ? html`<div class="bar-chart-labels" style="gap:${this.gap}px">
            ${this.data.map((item, i) => html`<span class="bar-label" data-state=${i === this.currentIndex ? "current" : ""} title=${item.label}>${item.label}</span>`)}
          </div>`
        : ""}`;
  },
});

/**
 * Bar Chart Component
 *
 * @component
 * @category display
 * @tag lc-bar-chart
 *
 * Bars with labels under them. Laid out with the box model rather than drawn in
 * a scaled `viewBox`, so the type stays the size it is asked to be instead of
 * growing with the container.
 *
 * Three states a bar can be in, each its own token: `filled`, `empty`: a real
 * zero, which still shows a stub so the axis reads: and `current`, the one the
 * reader is in. A datum's own `color` overrides all of it.
 *
 * `show-axis` draws five gridlines with their values on the left, over a scale
 * rounded up to a round top; `formatValue` labels a tick, and `1.2K` is the
 * default. `callout` is a bubble over the `currentIndex` bar. Both are for the
 * vertical chart.
 *
 * @example
 * ```html
 * <lc-bar-chart .data=${weeks} .currentIndex=${weeks.length - 1} height="130"></lc-bar-chart>
 * ```
 *
 * @example With an axis and a callout
 * ```html
 * <lc-bar-chart .data=${weeks} .currentIndex=${3} callout="12.4K" show-axis></lc-bar-chart>
 * ```
 */
