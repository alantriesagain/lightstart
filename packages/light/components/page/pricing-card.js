import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

/** @import { Prop, PricingCta } from "../types.ts" */

export default defineComponent({
  tag: "lc-pricing-card",
  style: true,
  themeTokens: {
    color: ["accent", "success", "surface", "surface-inverse", "text-primary", "text-secondary"],
    text: ["eyebrow", "caption", "body"],
    font: ["bold", "black", "medium"],
    spacing: ["xs", "sm", "md", "xl", "2xl"],
    radius: ["full", "panel"],
    shadow: ["card", "card-hover", "lg", "xl"],
  },
  props: {
    name: "",
    price: "",
    period: "",
    description: "",
    features: /** @type {Prop<string[]>} */ (T.array({
      attribute: false,
      defaultValue: [],
      itemType: T.string(),
    })),
    cta: /** @type {Prop<PricingCta>} */ (T.object({
      attribute: false,
      defaultValue: {},
      props: {
        label: T.string(),
        href: T.string(),
      },
    })),
    highlighted: false,
  },
  render() {
    const cta = this.cta;
    const features = this.features;
    const highlightedClass = this.highlighted
      ? "pricing-card-highlighted"
      : "pricing-card-standard";

    return html`
      <article class="pricing-card ${highlightedClass}">
        ${this.highlighted
          ? html`<span class="pricing-card-badge">${lcText("lc-pricing-card", "popular")}</span>`
          : ""}
        ${this.name
          ? html`<h3 class="pricing-card-name">${this.name}</h3>`
          : ""}
        ${this.description
          ? html`<p class="pricing-card-desc">${this.description}</p>`
          : ""}
        <div class="pricing-card-price-row">
          ${this.price
            ? html`<span class="pricing-card-price">${this.price}</span>`
            : ""}
          ${this.period
            ? html`<span class="pricing-card-period">${this.period}</span>`
            : ""}
        </div>
        ${features.length > 0
          ? html`<ul class="pricing-card-features">
              ${features.map(
                (f) => html`
                  <li class="pricing-card-feature">
                    <lc-icon
                      name="check"
                      class="pricing-card-feature-icon"
                    ></lc-icon>
                    <span>${f}</span>
                  </li>
                `,
              )}
            </ul>`
          : ""}
        ${cta.label
          ? html`<a href=${cta.href || "#"} class="pricing-card-cta"
              >${cta.label}</a
            >`
          : ""}
      </article>
    `;
  },
});
