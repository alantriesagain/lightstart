import { html } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

const TAG = /** @type {const} */ ("lc-pull-indicator");

/**
 * The hint a pull to refresh draws above the list: a band as tall as the pull
 * so far, with an arrow that turns once a release would refresh, and a
 * spinner while the refresh runs. It holds no gesture; a host with
 * `withPullToRefresh` hands it `pullY` and `refreshing`.
 *
 *   <lc-pull-indicator .pull=${this.pullY} ?refreshing=${this.refreshing}></lc-pull-indicator>
 */
export default defineComponent({
  tag: "lc-pull-indicator",
  style: true,
  props: {
    pull: 0,
    threshold: 64,
    refreshing: false,
  },

  willUpdate() {
    this.toggleAttribute("ready", this.pull >= this.threshold && !this.refreshing);
    this.toggleAttribute("open", this.pull > 0 && !this.refreshing);
  },

  render() {
    const ready = this.pull >= this.threshold;
    const height = this.refreshing ? "var(--lc-pull-indicator-refreshing-height, 3rem)" : `${Math.max(0, this.pull)}px`;
    return html`
      <div class="lc-pull-indicator-band" style=${`height:${height}`} role="status" aria-live="polite"
        aria-label=${this.refreshing ? lcText(TAG, "refreshing") : ready ? lcText(TAG, "release") : lcText(TAG, "pull")}>
        ${this.refreshing || this.pull > 0
          ? html`<span class="lc-pull-indicator-knob">
              ${this.refreshing ? html`<lc-spinner size="sm"></lc-spinner>` : html`<lc-icon name="arrow-down" size="16"></lc-icon>`}
            </span>`
          : ""}
      </div>
    `;
  },
});
