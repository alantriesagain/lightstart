import { html } from "/app/__light-runtime__.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";
import { colorScheme } from "/app/light/theme/color-scheme.js";
import { lcText } from "../utils/text.js";

export default defineComponent({
  tag: "lc-darkmode",
  icons: ["moon", "sun"],
  style: true,
  props: {
    width: "fit",
    compact: T.boolean(),
    inverted: T.boolean(),
    navItem: T.boolean(),
    label: "",
    size: T.string(),
    dark: T.boolean(),
  },
  getIcon() {
    if (this.inverted) return this.dark ? "moon" : "sun";
    return this.dark ? "sun" : "moon";
  },
  getLabel() {
    if (this.inverted) return this.dark ? "Dark Mode" : "Light Mode";
    return this.dark ? "Light Mode" : "Dark Mode";
  },
  /** @param {Event} e */
  toggle(e) {
    e.stopPropagation();
    colorScheme.toggle();
  },
  connected() {
    this.$own(colorScheme.dark.subscribe((on) => { this.dark = on; }));
    this.$on("button#click", this.toggle.bind(this));
  },
  render() {
    if (this.navItem)
      return html`<lc-nav-item
        icon=${this.getIcon()}
        label=${this.getLabel()}
        ?iconOnly=${this.compact}
        tooltip
        tooltipPosition="right"
        tooltipSize="lg"
      ></lc-nav-item>`;

    if (this.compact)
      return html`<button aria-label="darkmode toggle">
        <lc-icon ghost name=${this.getIcon()} size=${this.size || "28"} class="cursor-pointer shrink-0"></lc-icon>
      </button>`;

    return html`
      <div class="darkmode-row">
        <span class="darkmode-label">${this.label || lcText("lc-darkmode", "label")}</span>
        <lc-switch
          ?checked=${this.dark}
          @change=${(/** @type {CustomEvent<{ checked: boolean }>} */ e) => colorScheme.choose(e.detail.checked)}
        ></lc-switch>
      </div>`;
  },
});
