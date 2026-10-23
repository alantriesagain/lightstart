import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
/** @import { Prop, CtaSectionAction } from "../types.ts" */

export default defineComponent({
  tag: "lc-cta-section",
  style: true,
  themeTokens: {
    color: ["surface", "surface-inverse", "text-primary", "text-secondary"],
    text: ["section", "subhead", "body"],
    font: ["bold", "black", "medium"],
    spacing: ["lg", "xl", "2xl", "4xl"],
    radius: ["full"],
    shadow: ["sm"],
  },
  props: {
    variant: T.string({
      defaultValue: "dark",
      enum: ["light", "dark"],
    }),
    headline: "",
    subheadline: "",
    ctas: /** @type {Prop<CtaSectionAction[]>} */ (T.array({
      attribute: false,
      defaultValue: [],
      itemType: {
        label: T.string(),
        href: T.string(),
        variant: T.string({ enum: ["primary", "secondary"] }),
      },
    })),
  },
  render() {
    const isDark = this.variant === "dark";
    const ctas = this.ctas;
    const variantClass = isDark ? "cta-section-dark" : "cta-section-light";

    return html`
      <section class="cta-section ${variantClass}">
        <div class="max-w-4xl mx-auto text-center">
          ${this.headline
            ? html`<h2 class="cta-headline">${this.headline}</h2>`
            : ""}
          ${this.subheadline
            ? html`<p class="cta-subheadline">${this.subheadline}</p>`
            : ""}
          <div
            class="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            ${ctas.map((cta) =>
              cta.variant === "secondary"
                ? html`<a
                    href=${cta.href || "#"}
                    class="cta-btn cta-btn-secondary w-full sm:w-auto"
                    >${cta.label}</a
                  >`
                : html`<a
                    href=${cta.href || "#"}
                    class="cta-btn cta-btn-primary w-full sm:w-auto"
                    >${cta.label}</a
                  >`,
            )}
          </div>
        </div>
      </section>
    `;
  },
});
