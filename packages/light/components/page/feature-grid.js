import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
/** @import { Prop, FeatureGridItem } from "../types.ts" */

export default defineComponent({
  tag: "lc-feature-grid",
  style: true,
  themeTokens: {
    color: ["surface", "surface-inverse", "text-primary", "text-secondary"],
    text: ["eyebrow", "section", "subhead"],
    font: ["bold", "black", "medium"],
    spacing: ["sm", "lg", "xl"],
    radius: ["full", "panel", "lg"],
  },
  props: {
    variant: T.string({
      defaultValue: "dark",
      enum: ["light", "dark"],
    }),
    eyebrow: "",
    headline: "",
    subheadline: "",
    features: /** @type {Prop<FeatureGridItem[]>} */ (T.array({
      attribute: false,
      defaultValue: [],
      itemType: {
        icon: T.string(),
        title: T.string(),
        description: T.string(),
      },
    })),
    sectionId: "",
  },
  render() {
    const features = this.features;
    const variantClass =
      this.variant === "dark"
        ? "feature-grid-section-dark"
        : "feature-grid-section-light";

    return html`
      <section
        id=${this.sectionId || ""}
        class="feature-grid-section ${variantClass}"
      >
        <div class="max-w-6xl mx-auto">
          <div class="text-center mb-16">
            ${this.eyebrow
              ? html`<span class="feature-grid-eyebrow">${this.eyebrow}</span>`
              : ""}
            ${this.headline
              ? html`<h2 class="feature-grid-headline">${this.headline}</h2>`
              : ""}
            ${this.subheadline
              ? html`<p class="feature-grid-subheadline">
                  ${this.subheadline}
                </p>`
              : ""}
          </div>
          <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            ${features.map(
              (feature) => html`
                <div class="feature-card group">
                  <div class="feature-card-icon-box">
                    <lc-icon
                      name=${feature.icon || ""}
                      class="feature-card-icon"
                    ></lc-icon>
                  </div>
                  <h3 class="feature-card-title">${feature.title}</h3>
                  <p class="feature-card-desc">${feature.description}</p>
                </div>
              `,
            )}
          </div>
        </div>
      </section>
    `;
  },
});
