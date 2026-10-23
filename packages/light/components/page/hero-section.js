import { html, unsafeHTML } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

/** @import { Prop, HeroEyebrow, HeroCta } from "../types.ts" */

/** @param {unknown} value */
const renderRich = (value) =>
  value == null ? "" : typeof value === "string" ? unsafeHTML(value) : value;

export default defineComponent({
  tag: "lc-hero-section",
  style: true,
  themeTokens: {
    color: ["primary", "secondary", "surface", "text-primary", "text-secondary", "text-muted"],
    text: ["hero", "subhead", "body", "caption", "eyebrow"],
    font: ["bold", "medium", "semibold"],
    spacing: ["md", "lg", "2xl", "3xl"],
    radius: ["full"],
    shadow: ["sm", "lg"],
  },
  props: {
    eyebrow: /** @type {Prop<HeroEyebrow>} */ (
      T.object({
        attribute: false,
        defaultValue: {},
        props: {
          badge: T.string(),
          label: T.string(),
          meta: T.string(),
          href: T.string(),
        },
      })
    ),
    headline: "",
    subheadline: "",
    ctas: /** @type {Prop<HeroCta[]>} */ (
      T.array({
        attribute: false,
        defaultValue: [],
        itemType: {
          label: T.string(),
          href: T.string(),
          variant: T.string({ enum: ["primary", "secondary"] }),
        },
      })
    ),
    decorations: T.object({ attribute: false, defaultValue: null }),
    image: T.string({ defaultValue: "", fieldType: "file", accept: "image/*" }),
  },
  render() {
    const eyebrow = this.eyebrow;
    const ctas = this.ctas;

    const heroVisual = this.image
      ? html`<img src=${this.image} alt="" class="w-full rounded-[24px] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12)] border border-dim" loading="lazy" />`
      : renderRich(this.decorations);

    return html`
      <section
        class="relative pt-36 pb-24 px-4 min-h-[100vh] flex flex-col items-center"
      >
        <div class="hero-bg"></div>
        <div class="max-w-[850px] mx-auto text-center z-10">
          ${eyebrow.label
            ? html`<a href=${eyebrow.href || "#"} class="hero-eyebrow">
                ${eyebrow.badge
                  ? html`<span class="hero-eyebrow-badge"
                      >${eyebrow.badge}</span
                    >`
                  : ""}
                <span class="hero-eyebrow-label">${eyebrow.label}</span>
                ${eyebrow.meta
                  ? html`<span class="hero-eyebrow-meta">${eyebrow.meta}</span>`
                  : ""}
              </a>`
            : ""}
          <h1 class="hero-headline">${unsafeHTML(this.headline)}</h1>
          <p class="hero-subheadline">${this.subheadline}</p>
          <div
            class="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            ${ctas.map((cta) =>
              cta.variant === "secondary"
                ? html`<a
                    href=${cta.href || "#"}
                    class="hero-cta hero-cta-secondary w-full sm:w-auto"
                    >${cta.label}</a
                  >`
                : html`<a
                    href=${cta.href || "#"}
                    class="hero-cta hero-cta-primary w-full sm:w-auto"
                    >${cta.label}</a
                  >`,
            )}
          </div>
        </div>
        <div class="mt-20 relative w-full max-w-[1040px] z-20">
          ${heroVisual}
        </div>
      </section>
    `;
  },
});
