import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

/** @import { Prop, PricingPlan } from "../types.ts" */

export default defineComponent({
  tag: "lc-pricing-table",
  style: true,
  themeTokens: {
    color: ["surface", "text-primary", "text-secondary"],
    text: ["eyebrow", "section", "subhead"],
    font: ["bold", "black", "medium"],
    spacing: ["lg", "xl", "3xl", "4xl"],
    radius: ["full"],
  },
  props: {
    eyebrow: "",
    headline: "",
    subheadline: "",
    plans: /** @type {Prop<PricingPlan[]>} */ (T.array({
      attribute: false,
      defaultValue: [],
      itemType: {
        name: T.string(),
        price: T.string(),
        period: T.string(),
        description: T.string(),
        features: T.array({ itemType: T.string() }),
        cta: T.object({
          props: {
            label: T.string(),
            href: T.string(),
          },
        }),
        highlighted: T.boolean(),
      },
    })),
    sectionId: "",
  },
  render() {
    const plans = this.plans;

    return html`
      <section id=${this.sectionId || ""} class="pricing-table-section">
        <div class="pricing-table-inner">
          <div class="pricing-table-head">
            ${this.eyebrow
              ? html`<span class="pricing-table-eyebrow"
                  >${this.eyebrow}</span
                >`
              : ""}
            ${this.headline
              ? html`<h2 class="pricing-table-headline">
                  ${this.headline}
                </h2>`
              : ""}
            ${this.subheadline
              ? html`<p class="pricing-table-subheadline">
                  ${this.subheadline}
                </p>`
              : ""}
          </div>
          <div class="pricing-table-grid">
            ${plans.map(
              (plan) => html`
                <lc-pricing-card
                  .name=${plan.name || ""}
                  .price=${plan.price || ""}
                  .period=${plan.period || ""}
                  .description=${plan.description || ""}
                  .features=${plan.features || []}
                  .cta=${plan.cta || {}}
                  ?highlighted=${!!plan.highlighted}
                ></lc-pricing-card>
              `,
            )}
          </div>
        </div>
      </section>
    `;
  },
});
