import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
/** @import { Prop, StatItem } from "../types.ts" */

export default defineComponent({
  tag: "lc-stats-section",
  style: true,
  themeTokens: {
    color: ["surface", "surface-inverse", "text-primary", "text-secondary"],
    text: ["eyebrow", "section", "subhead", "body", "caption"],
    font: ["bold", "black", "medium"],
    spacing: ["sm", "lg", "xl", "2xl", "3xl", "4xl"],
    radius: ["full", "panel", "md"],
  },
  props: {
    variant: T.string({
      defaultValue: "light",
      enum: ["light", "dark"],
    }),
    eyebrow: "",
    headline: "",
    subheadline: "",
    stats: /** @type {Prop<StatItem[]>} */ (
      T.array({
        attribute: false,
        defaultValue: [],
        itemType: {
          value: T.string(),
          label: T.string(),
          description: T.string(),
          icon: T.string(),
        },
      })
    ),
    sectionId: "",
  },
  render() {
    const stats = this.stats;
    const variantClass =
      this.variant === "dark"
        ? "stats-section-dark"
        : "stats-section-light";

    return html`
      <section
        id=${this.sectionId || ""}
        class="stats-section ${variantClass}"
      >
        <div class="stats-section-inner">
          <div class="stats-section-head">
            ${this.eyebrow
              ? html`<span class="stats-eyebrow">${this.eyebrow}</span>`
              : ""}
            ${this.headline
              ? html`<h2 class="stats-headline">${this.headline}</h2>`
              : ""}
            ${this.subheadline
              ? html`<p class="stats-subheadline">${this.subheadline}</p>`
              : ""}
          </div>
          <div class="stats-grid">
            ${stats.map(
              (stat) => html`
                <div class="stat-item">
                  ${stat.icon
                    ? html`<div class="stat-icon-box">
                        <lc-icon
                          name=${stat.icon}
                          class="stat-icon"
                        ></lc-icon>
                      </div>`
                    : ""}
                  ${stat.value
                    ? html`<div class="stat-value">${stat.value}</div>`
                    : ""}
                  ${stat.label
                    ? html`<div class="stat-label">${stat.label}</div>`
                    : ""}
                  ${stat.description
                    ? html`<p class="stat-description">
                        ${stat.description}
                      </p>`
                    : ""}
                </div>
              `,
            )}
          </div>
        </div>
      </section>
    `;
  },
});
